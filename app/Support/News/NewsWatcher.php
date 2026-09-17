<?php

namespace App\Support\News;

use App\Models\ExternalOccurrence;
use App\Models\NewsArticle;
use App\Models\NewsDetection;
use App\Models\WatcherReport;
use App\Support\EarlyWarning;
use App\Support\HazardClassifier;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * The news watcher, fully automatic.
 *
 * 1. Reads Google News searches plus the official / newsroom feeds that allow
 *    it (Sources::DIRECT_FEEDS), keeping only articles from trusted sources.
 * 2. NewsReader keeps flying occurrences; articles about one event are grouped.
 * 3. Each event is decided without anyone clicking:
 *    - verified (1 official or aviation-safety source, a trusted newsroom quoting
 *      an official body such as "PAF:" or "CAAP says", or 2 independent
 *      newsrooms) and relevant to the Wing → logged as an outside occurrence;
 *    - verified but not relevant → kept for information;
 *    - one newsroom only → waits for a second source.
 * 4. Staff can undo an automatic log or log something anyway. Those human
 *    decisions train RelevanceModel, which can then hold back an automatic log
 *    that looks like what the office usually removes (and flag the reverse).
 *
 * Runs hourly from the scheduler (cPanel cron), and on its own when the
 * Forecast page is opened and the last check is over 90 minutes old.
 */
class NewsWatcher
{
    public const FEED = 'https://news.google.com/rss/search';

    /**
     * Google News searches, broad on purpose: Sources drops untrusted outlets
     * and NewsReader drops what isn't about flying safety.
     */
    public const QUERIES = [
        'Philippine aviation occurrences' => '(plane OR aircraft OR helicopter OR chopper OR jet OR drone) (crash OR crashed OR "emergency landing" OR "bird strike" OR "runway excursion" OR skidded OR "engine trouble" OR "engine failure" OR "hard landing" OR "forced landing") Philippines',
        'Military and government aircraft' => '("Philippine Air Force" OR "Philippine Navy" OR "Philippine Army" OR "Coast Guard" OR PNP OR AFP) (aircraft OR helicopter OR chopper OR jet OR plane) (crash OR "emergency landing" OR grounded OR mishap OR engine OR incident)',
        'Airports and flight disruptions' => '(CAAP OR airport) Philippines (suspended OR "disabled aircraft" OR "runway excursion" OR diverted OR "bird strike" OR "emergency landing" OR cancelled)',
        'Mindanao airports and airspace' => '(Davao OR Zamboanga OR "Cagayan de Oro" OR Laguindingan OR Cotabato OR "General Santos" OR Butuan OR Jolo OR Dipolog OR Pagadian OR Mindanao) (aircraft OR plane OR helicopter OR flight) (incident OR suspended OR emergency OR crash OR "bird strike")',
        'Our aircraft types anywhere' => '("Super Tucano" OR AW109 OR "SF-260" OR "MD 530" OR T129 OR "OV-10") (crash OR "emergency landing" OR grounded OR incident)',
        // Short searches catch what the long ones rank too low.
        'Crashes in the Philippines' => '(plane OR helicopter OR chopper) crash Philippines',
        'Emergency landings' => '"emergency landing" (Philippines OR PAF OR CAAP OR Cebu OR Davao OR Manila OR Mindanao)',
        'Bird strikes' => '"bird strike" (Philippines OR CAAP OR NAIA OR Davao OR Cebu OR Mindanao OR Clark)',
        'Nearby countries (same weather)' => '("air force" OR military OR navy OR army) (helicopter OR aircraft OR jet) (crash OR "emergency landing") (Indonesia OR Malaysia OR Vietnam OR Thailand OR Brunei)',
    ];

    /** How far back to look: a longer first sweep, then just recent days. */
    public const FIRST_RUN_DAYS = 45;

    public const RUN_DAYS = 7;

    /** Events older than this drop off the lists. */
    public const KEEP_DAYS = 45;

    /** The Forecast page triggers a check when the last one is older than this. */
    public const STALE_MINUTES = 90;

    /** Days an event reported by one newsroom waits for a second source. */
    public const WAIT_DAYS = 7;

    /** Points (NewsWatcher::scoreOf) an event needs before it's logged automatically. */
    public const LOG_SCORE = 2;

    /** Once the model has learned: below this it holds an automatic log for a person; above the other it flags an info item. */
    public const MODEL_HOLD = 0.25;

    public const MODEL_FLAG = 0.75;

    /**
     * Articles within this many days of each other can be the same event.
     * Crashes keep making news for a week or more (recovery, names, grounding).
     */
    private const SAME_EVENT_DAYS = ['accident' => 10, 'default' => 3];

    private const SEVERITY = ['accident' => 4, 'incident' => 3, 'hazard' => 2, 'disruption' => 1];

    private const UA = '15SW-Safety-watcher/1.0 (Wing Safety Office)';

    /** @return array<string, mixed> what the run did */
    public static function run(?Carbon $now = null): array
    {
        $lock = Cache::lock('news-watcher', 300);
        if (! $lock->get()) {
            return ['skipped' => 'Another check is already running.'];
        }

        try {
            return self::sweep($now ?? now());
        } finally {
            $lock->release();
        }
    }

    public static function due(): bool
    {
        $last = self::lastCheck();

        return ! $last || $last->lt(now()->subMinutes(self::STALE_MINUTES));
    }

    public static function lastCheck(): ?Carbon
    {
        return WatcherReport::query()->firstWhere('kind', WatcherReport::NEWS)?->generated_at;
    }

    /** @return array<string, mixed> */
    private static function sweep(Carbon $now): array
    {
        $days = NewsDetection::query()->exists() ? self::RUN_DAYS : self::FIRST_RUN_DAYS;
        $since = $now->copy()->subDays($days);
        $stats = ['checked_at' => $now->toIso8601String(), 'days' => $days, 'articles' => 0, 'untrusted' => 0,
            'relevant' => 0, 'new' => 0, 'grouped' => 0, 'logged' => 0, 'errors' => []];

        $topCauses = EarlyWarning::topCauses();
        $recent = NewsDetection::query()
            ->whereDate('occurred_on', '>=', $since->copy()->subDays(self::SAME_EVENT_DAYS['accident'] + 30)->toDateString())
            ->with('articles')
            ->get();
        $touched = [];

        $feeds = [];
        foreach (self::QUERIES as $label => $query) {
            $feeds[$label] = fn () => self::fetch(self::FEED, ['q' => "{$query} when:{$days}d", 'hl' => 'en-PH', 'gl' => 'PH', 'ceid' => 'PH:en']);
        }
        foreach (Sources::DIRECT_FEEDS as $label => [$url, $domain]) {
            $feeds[$label] = fn () => array_map(fn ($i) => ['source_url' => "https://{$domain}", 'source' => $label] + $i, self::fetch($url));
        }

        foreach ($feeds as $label => $load) {
            try {
                $items = $load();
            } catch (Throwable $e) {
                $stats['errors'][] = "{$label}: ".class_basename($e);

                continue;
            }

            foreach ($items as $item) {
                $stats['articles']++;
                if ($item['published_at']->lt($since) || $item['published_at']->gt($now->copy()->addDay())) {
                    continue;
                }
                // Proper sources only: an outlet not on the trusted list is ignored.
                $trust = Sources::trust($item['source_url'] ?? null);
                if (! $trust) {
                    $stats['untrusted']++;

                    continue;
                }
                $hash = sha1($item['guid']);
                if (NewsArticle::query()->where('guid_hash', $hash)->exists()) {
                    continue;
                }
                $found = NewsReader::read($item['title'], $item['source']);
                if (! $found) {
                    continue;
                }
                $stats['relevant']++;

                $day = $item['published_at']->copy()->timezone('Asia/Manila')->startOfDay();
                $match = self::sameEvent($recent, $found, $day);
                if ($match) {
                    self::merge($match, $found, $day, $topCauses);
                    $stats['grouped']++;
                } else {
                    $match = NewsDetection::create([...$found, 'occurred_on' => $day->toDateString(),
                        'status' => NewsDetection::WAITING, 'auto' => true, ...self::scoreOf($found, $topCauses)]);
                    $match->setRelation('articles', new Collection);
                    $recent->push($match);
                    $stats['new']++;
                }

                $match->articles->push($match->articles()->create([
                    'guid_hash' => $hash,
                    'title' => mb_substr($item['title'], 0, 400),
                    'source' => $trust['name'],
                    'domain' => $trust['domain'],
                    'tier' => $trust['tier'],
                    'url' => mb_substr($item['url'], 0, 1000),
                    'published_at' => $item['published_at'],
                ]));
                $touched[$match->id] = $match;
            }
        }

        // Decide every event that changed, plus any still waiting for a second source.
        $model = RelevanceModel::fromDatabase();
        $waiting = NewsDetection::query()->where('auto', true)->whereIn('status', [NewsDetection::WAITING, NewsDetection::PENDING])
            ->whereNotIn('id', array_keys($touched))->with('articles')->get();
        foreach ([...array_values($touched), ...$waiting->all()] as $d) {
            $stats['logged'] += (int) self::decide($d, $model);
        }

        WatcherReport::updateOrCreate(['kind' => WatcherReport::NEWS], [
            'payload' => $stats,
            'source' => 'Google News + official and newsroom feeds',
            'generated_at' => $now,
        ]);

        return $stats;
    }

    /**
     * One RSS feed, as plain items. Google News items carry the outlet's web
     * address in <source url="…">, which is what the trust check uses.
     *
     * @param  array<string, string>  $query
     * @return list<array{guid: string, title: string, url: string, source: ?string, source_url: ?string, published_at: Carbon}>
     */
    public static function fetch(string $url, array $query = []): array
    {
        $response = Http::timeout(20)->retry(2, 500, throw: false)
            ->withHeaders(['User-Agent' => self::UA])
            ->get($url, $query);
        $response->throw();

        $xml = @simplexml_load_string($response->body(), 'SimpleXMLElement', LIBXML_NOCDATA);
        if ($xml === false) {
            throw new \RuntimeException('The feed was not valid XML.');
        }

        $items = [];
        foreach ($xml->channel->item ?? [] as $node) {
            $title = trim((string) $node->title);
            $link = trim((string) $node->link);
            if ($title === '' || $link === '') {
                continue;
            }
            try {
                $published = Carbon::parse((string) $node->pubDate);
            } catch (Throwable) {
                continue;
            }
            $items[] = [
                'guid' => trim((string) $node->guid) ?: $link,
                'title' => $title,
                'url' => $link,
                'source' => trim((string) $node->source) ?: null,
                'source_url' => isset($node->source) ? ((string) $node->source['url'] ?: null) : null,
                'published_at' => $published,
            ];
        }

        return $items;
    }

    /**
     * The automatic decision for one event. Never overrides a person's
     * decision. Returns true when this call logged it.
     */
    public static function decide(NewsDetection $d, RelevanceModel $model): bool
    {
        if (! $d->auto) {
            return false;
        }
        $backing = Sources::corroboration(self::backingInput($d));
        $d->trust = $backing['level'];
        $relevant = $d->score >= self::LOG_SCORE && ($d->kind !== 'disruption' || $d->region === EarlyWarning::PRIORITY_REGION);
        $chance = $model->probability(RelevanceModel::features($d));

        $status = match (true) {
            $d->status === NewsDetection::CONFIRMED => NewsDetection::CONFIRMED,   // already logged: stays logged
            // One newsroom and nobody else picked it up within a week: keep it, just for information.
            ! $backing['verified'] && $d->occurred_on->lt(now('Asia/Manila')->startOfDay()->subDays(self::WAIT_DAYS)) => NewsDetection::INFO,
            ! $backing['verified'] => NewsDetection::WAITING,
            $relevant && $chance !== null && $chance < self::MODEL_HOLD => NewsDetection::PENDING,
            $relevant => NewsDetection::CONFIRMED,
            $chance !== null && $chance > self::MODEL_FLAG => NewsDetection::PENDING,
            default => NewsDetection::INFO,
        };

        $logged = false;
        if ($status === NewsDetection::CONFIRMED && ! $d->external_occurrence_id) {
            $d->external_occurrence_id = self::log($d)->id;
            $logged = true;
        }
        $d->status = $status;
        $d->save();

        return $logged;
    }

    /** Log a verified, relevant event as an outside occurrence (an advisory). */
    private static function log(NewsDetection $d): ExternalOccurrence
    {
        $byAuthority = $d->articles->sortBy(fn (NewsArticle $a) => [Sources::OFFICIAL => 0, Sources::AVIATION => 1][$a->tier] ?? 2);
        $names = $byAuthority->pluck('source')->unique()->take(3)->implode(', ');
        // Link the most authoritative article whose address fits the field (a cut-off link is useless).
        $best = $byAuthority->first(fn (NewsArticle $a) => mb_strlen($a->url) <= 500);

        return ExternalOccurrence::create([
            'occurred_on' => $d->occurred_on->toDateString(),
            'region' => match ($d->region) {
                'mindanao', 'visayas', 'luzon', 'philippines' => $d->region,
                default => 'outside',
            },
            'location' => $d->place ?? 'Not stated in the news',
            'aircraft' => $d->fleet_type ?? $d->aircraft,
            'category' => in_array($d->category, ExternalOccurrence::categories(), true) ? $d->category : HazardClassifier::OTHER,
            'summary' => mb_substr("{$d->headline} (logged automatically from {$names})", 0, 2000),
            'source_url' => $best?->url,
            'brief_until' => $d->occurred_on->copy()->addDays(ExternalOccurrence::DEFAULT_BRIEF_DAYS)->toDateString(),
        ]);
    }

    /** @return Collection<int, array{tier: string, domain: string, title: string}> */
    private static function backingInput(NewsDetection $d): Collection
    {
        return $d->articles->map(fn (NewsArticle $a) => [
            'tier' => $a->tier, 'domain' => $a->domain, 'title' => NewsReader::clean($a->title, $a->source),
        ]);
    }

    /** A person removes an event (and its automatic log). The model learns from it. */
    public static function dismiss(NewsDetection $d, ?int $userId): void
    {
        DB::transaction(function () use ($d, $userId) {
            $occurrence = $d->occurrence;
            $d->update(['status' => NewsDetection::DISMISSED, 'auto' => false, 'reviewed_by' => $userId,
                'reviewed_at' => now(), 'external_occurrence_id' => null]);
            // Only remove a log the watcher made; one a person wrote stays.
            if ($occurrence && $occurrence->created_by === null) {
                $occurrence->delete();
            }
        });
    }

    /** Hand an event back to the watcher to decide again. */
    public static function restore(NewsDetection $d): void
    {
        $d->update(['status' => NewsDetection::WAITING, 'auto' => true, 'reviewed_by' => null, 'reviewed_at' => null]);
        self::decide($d->load('articles'), RelevanceModel::fromDatabase());
    }

    /**
     * The detection this article most likely belongs to: close in time, and
     * either similar headline words or the same place / aircraft and kind.
     *
     * @param  Collection<int, NewsDetection>  $recent
     * @param  array<string, mixed>  $found
     */
    private static function sameEvent(Collection $recent, array $found, Carbon $day): ?NewsDetection
    {
        $words = NewsReader::tokens($found['headline']);
        $best = null;
        $bestScore = 0.0;

        foreach ($recent as $d) {
            $window = in_array('accident', [$d->kind, $found['kind']], true) ? self::SAME_EVENT_DAYS['accident'] : self::SAME_EVENT_DAYS['default'];
            if (abs($d->occurred_on->diffInDays($day, false)) > $window) {
                continue;
            }
            $theirs = NewsReader::tokens($d->headline);
            foreach ($d->articles as $a) {
                $theirs = [...$theirs, ...NewsReader::tokens(NewsReader::clean($a->title, $a->source))];
            }
            $theirs = array_unique($theirs);
            $shared = count(array_intersect($words, $theirs));
            $similar = $words ? $shared / max(1, count(array_unique([...$words, ...NewsReader::tokens($d->headline)]))) : 0;

            $score = $similar;
            // Same place ("Sarawak, Malaysia" counts as Malaysia too) and the same kind of event.
            $samePlace = $found['place'] && $d->place
                && ($found['place'] === $d->place || str_contains($found['place'], $d->place) || str_contains($d->place, $found['place']));
            if ($samePlace && ($found['kind'] === $d->kind || $shared >= 2)) {
                $score = max($score, 0.6);
            }
            if ($found['fleet_type'] && $found['fleet_type'] === $d->fleet_type && $found['kind'] === $d->kind) {
                $score = max($score, 0.6);
            }
            if ($score > $bestScore) {
                [$best, $bestScore] = [$d, $score];
            }
        }

        return $bestScore >= 0.34 ? $best : null;
    }

    /**
     * @param  array<string, mixed>  $found
     * @param  list<string>  $topCauses
     */
    private static function merge(NewsDetection $d, array $found, Carbon $day, array $topCauses): void
    {
        if ($day->lt($d->occurred_on)) {
            $d->occurred_on = $day;
        }
        // Later reports often name the place or type the first headline left out.
        foreach (['place', 'aircraft', 'fleet_type'] as $field) {
            $d->{$field} ??= $found[$field];
        }
        if ($d->region === null || in_array($d->region, ['philippines', 'outside'], true) && ! in_array($found['region'], ['philippines', 'outside'], true)) {
            $d->region = $found['region'];
        }
        $d->military = $d->military || $found['military'];
        // Keep the most serious and most specific headline for the event.
        $current = NewsReader::read($d->headline) ?? ['kind' => $d->kind, 'place' => null, 'aircraft' => null, 'fleet_type' => null];
        if (self::SEVERITY[$found['kind']] > self::SEVERITY[$d->kind]
            || (self::SEVERITY[$found['kind']] === self::SEVERITY[$d->kind] && self::specificity($found) > self::specificity($current))) {
            $d->kind = $found['kind'];
            $d->headline = $found['headline'];
            $d->category = $found['category'];
        }
        $d->fill(self::scoreOf($d->only(['kind', 'region', 'fleet_type', 'military', 'category']), $topCauses));
        $d->save();
    }

    /** How much a headline tells: our type, an aircraft, a place, a clear category. */
    private static function specificity(array $found): int
    {
        return ($found['fleet_type'] ? 2 : 0) + ($found['aircraft'] ? 1 : 0) + ($found['place'] ? 1 : 0)
            + (($found['category'] ?? HazardClassifier::OTHER) !== HazardClassifier::OTHER ? 1 : 0);
    }

    /**
     * Why it matters to the Wing, as plain reasons and a points total.
     *
     * @param  array<string, mixed>  $d
     * @param  list<string>  $topCauses
     * @return array{why: list<string>, score: int}
     */
    public static function scoreOf(array $d, array $topCauses): array
    {
        $why = [];
        $score = 0;
        $add = function (string $reason, int $points) use (&$why, &$score) {
            $why[] = $reason;
            $score += $points;
        };

        if ($d['fleet_type'] ?? null) {
            $add("Our aircraft type ({$d['fleet_type']})", 3);
        }
        match ($d['region'] ?? null) {
            'mindanao' => $add('Mindanao', 2),
            'luzon', 'visayas', 'philippines' => $add('In the Philippines', 1),
            'nearby' => $add('Nearby country, similar weather', 0),   // context, not a reason to log on its own
            default => null,
        };
        if ($d['military'] ?? false) {
            $add('Military / government aircraft', 1);
        }
        if (in_array($d['category'] ?? null, $topCauses, true)) {
            $add('One of our top causes', 1);
        }
        if (($d['kind'] ?? null) === 'accident') {
            $add('Crash / accident', 1);
        }

        return ['why' => $why, 'score' => $score];
    }

    /**
     * Everything the Forecast page shows about the watcher.
     *
     * @return array<string, mixed>
     */
    public static function panel(?Carbon $today = null): array
    {
        $today ??= now('Asia/Manila')->startOfDay();
        $model = RelevanceModel::fromDatabase();
        $recent = NewsDetection::query()
            ->whereDate('occurred_on', '>=', $today->copy()->subDays(self::KEEP_DAYS)->toDateString())
            ->with('articles')
            ->orderByDesc('occurred_on')->orderByDesc('score')
            ->get()
            ->map(fn (NewsDetection $d) => self::present($d, $model))
            ->groupBy('status');
        $list = fn (string $status) => $recent->get($status, collect())->values()->all();

        $report = WatcherReport::query()->firstWhere('kind', WatcherReport::NEWS);
        $accuracy = $model->accuracy();

        return [
            'check' => $list(NewsDetection::PENDING),
            'logged' => $list(NewsDetection::CONFIRMED),
            'waiting' => $list(NewsDetection::WAITING),
            'info' => $list(NewsDetection::INFO),
            'dismissed' => $list(NewsDetection::DISMISSED),
            'model' => [
                ...$model->examples(),
                'ready' => $model->ready(),
                'needed_each' => RelevanceModel::MIN_EACH,
                'accuracy' => $accuracy === null ? null : round($accuracy * 100),
            ],
            'last_check' => $report ? [
                'at' => $report->generated_at?->timezone('Asia/Manila')->format('d M Y H:i'),
                'articles' => $report->payload['articles'] ?? 0,
                'untrusted' => $report->payload['untrusted'] ?? 0,
                'relevant' => $report->payload['relevant'] ?? 0,
                'logged' => $report->payload['logged'] ?? 0,
                'errors' => $report->payload['errors'] ?? [],
            ] : null,
            'sources' => [
                'feeds' => array_keys(Sources::DIRECT_FEEDS),
                'searches' => count(self::QUERIES),
            ],
            'regions' => NewsDetection::REGIONS,
            'kinds' => NewsDetection::KINDS,
        ];
    }

    /** @return array<string, mixed> */
    private static function present(NewsDetection $d, RelevanceModel $model): array
    {
        $features = RelevanceModel::features($d);
        $backing = Sources::corroboration(self::backingInput($d));

        return [
            'id' => $d->id,
            'status' => $d->status,
            'auto' => $d->auto,
            'occurred_on' => $d->occurred_on->format('Y-m-d'),
            'display_date' => $d->occurred_on->format('d M Y'),
            'headline' => $d->headline,
            'kind' => $d->kind,
            'region' => $d->region,
            'place' => $d->place,
            'aircraft' => $d->aircraft,
            'fleet_type' => $d->fleet_type,
            'military' => $d->military,
            'category' => $d->category,
            'why' => $d->why ?? [],
            'score' => $d->score,
            'backing' => $backing,
            'relevance' => $model->probability($features),
            'learned' => $model->reasons($features),
            'article_count' => $d->articles->count(),
            'sources' => $d->articles->map(fn (NewsArticle $a) => ['name' => $a->source, 'tier' => $a->tier])
                ->unique('name')->sortBy(fn ($s) => [Sources::OFFICIAL => 0, Sources::AVIATION => 1][$s['tier']] ?? 2)
                ->values()->all(),
            'articles' => $d->articles->sortByDesc('published_at')->take(8)->map(fn (NewsArticle $a) => [
                'title' => NewsReader::clean($a->title, $a->source),
                'source' => $a->source,
                'tier' => $a->tier,
                'url' => $a->url,
                'date' => $a->published_at->timezone('Asia/Manila')->format('d M'),
            ])->values()->all(),
            // Pre-fills the log form when staff log something the watcher didn't.
            'prefill' => [
                'occurred_on' => $d->occurred_on->format('Y-m-d'),
                'region' => match ($d->region) {
                    'mindanao', 'visayas', 'luzon', 'philippines' => $d->region,
                    'nearby', 'outside' => 'outside',
                    default => null,
                },
                'location' => $d->place ?? '',
                'aircraft' => $d->fleet_type ?? $d->aircraft ?? '',
                'category' => in_array($d->category, ExternalOccurrence::categories(), true) ? $d->category : null,
                'summary' => $d->headline,
                'source_url' => $d->articles->first()?->url ?? '',
            ],
        ];
    }
}
