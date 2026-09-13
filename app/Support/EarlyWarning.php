<?php

namespace App\Support;

use App\Models\ExternalOccurrence;
use App\Models\Mishap;
use App\Models\SafetyForecast;
use Illuminate\Support\Carbon;

/**
 * The "one step ahead" layer under the SPI: signals that can come BEFORE a
 * mishap in the Wing — live airfield weather, the season, and occurrences
 * elsewhere. Advisories only: none of this changes the SPI or the base rate,
 * which stay measures of 15SW's own record.
 *
 * Levels: brief (brief crews) · aware (be aware) · info / clear.
 */
class EarlyWarning
{
    /** Area the Wing asked to watch first. */
    public const PRIORITY_REGION = 'mindanao';

    /** @return array<string, mixed> */
    public static function build(): array
    {
        return [
            'odds' => self::odds(),
            'weather' => AirfieldWeather::snapshot(),
            'season' => self::season(),
            'external' => self::external(),
            'options' => [
                'regions' => ExternalOccurrence::REGIONS,
                'categories' => ExternalOccurrence::categories(),
                'aircraft' => Mishap::AIRCRAFT,
                'default_days' => ExternalOccurrence::DEFAULT_BRIEF_DAYS,
            ],
        ];
    }

    /**
     * Chances from the Wing's own record over the last 5 years (the same
     * period as the weekly base rate). Each is "how often it happened", shown
     * with its count so nobody mistakes it for a guarantee.
     *
     * @return array<string, mixed>
     */
    public static function odds(?Carbon $today = null): array
    {
        $today ??= now('Asia/Manila');
        $thisWeek = $today->copy()->startOfWeek();
        $weeks = self::weeks($thisWeek, $thisWeek->copy()->subYears(5));
        if ($weeks === []) {
            return [];
        }

        $month = (int) $today->month;
        $birdWindow = match (true) {
            in_array($month, [9, 10, 11], true) => ['Sep–Nov', [9, 10, 11]],
            in_array($month, [2, 3, 4, 5], true) => ['Feb–May', [2, 3, 4, 5]],
            default => null,
        };

        $since = Carbon::parse(Mishap::query()->min('mishap_date'))->year;

        return [
            'period' => 'last 5 years',
            'flight_week' => self::share($weeks, fn ($w) => $w['flight']),
            'any_week' => self::share($weeks, fn ($w) => $w['any']),
            'bird_week' => $birdWindow
                ? self::seasonal($birdWindow[1], 'bird') + ['label' => "{$birdWindow[0]} weeks since {$since}"]
                : self::share($weeks, fn ($w) => $w['bird']) + ['label' => 'last 5 years'],
        ];
    }

    /**
     * Calendar factors, each with how often it went wrong in those weeks
     * before, from the Wing's own record.
     *
     * @return list<array{text: string, detail: string, level: string, chance?: array<string, mixed>}>
     */
    public static function season(?Carbon $today = null): array
    {
        $today ??= now('Asia/Manila');
        $month = (int) $today->month;
        $items = [];

        $birdMonths = Mishap::query()->where('category', 'Bird / wildlife strike')->pluck('mishap_date')
            ->map(fn ($d) => (int) Carbon::parse($d)->month);
        $windows = [
            'Bird migration — southbound peak (Sep–Nov)' => [9, 10, 11],
            'Bird migration — northbound passage (Feb–May)' => [2, 3, 4, 5],
        ];
        foreach ($windows as $text => $months) {
            if (in_array($month, $months, true)) {
                $inWindow = $birdMonths->filter(fn ($m) => in_array($m, $months, true))->count();
                $chance = self::compare('Bird / wildlife strike', self::seasonal($months, 'bird'), 'these weeks');
                $items[] = [
                    'text' => $text,
                    'detail' => "{$inWindow} of the Wing's {$birdMonths->count()} bird / wildlife strikes happened in these months.",
                    'chance' => $chance,
                    // The badge follows the numbers: brief only when this season really runs higher.
                    'level' => $chance['verdict'] === 'higher than usual' ? 'brief' : 'aware',
                ];
            }
        }

        [$monsoon, $detail, $months, $short] = match (true) {
            in_array($month, [6, 7, 8, 9], true) => ['Southwest monsoon (Habagat)', 'Afternoon thunderstorms and heavy rain.', [6, 7, 8, 9], 'Habagat weeks'],
            in_array($month, [11, 12, 1, 2], true) => ['Northeast monsoon (Amihan)', 'Stronger surface winds, cooler air.', [11, 12, 1, 2], 'Amihan weeks'],
            in_array($month, [3, 4, 5], true) => ['Pre-monsoon build-up', 'Hot and hazy; isolated thunderstorms.', [3, 4, 5], 'Mar–May weeks'],
            default => ['Monsoon transition (October)', 'Unsettled, less predictable weather.', [10], 'October weeks'],
        };
        $chance = self::compare('Flight mishap', self::seasonal($months, 'flight'), $short);
        $items[] = [
            'text' => $monsoon,
            'detail' => $detail,
            'chance' => $chance,
            'level' => $chance['verdict'] === 'higher than usual' ? 'brief' : 'aware',
        ];

        // El Niño / La Niña status comes from the weekly notebook update (NOAA index).
        $week = SafetyForecast::query()->whereNull('base')
            ->whereDate('week_start', $today->copy()->startOfWeek()->toDateString())->first();
        foreach ($week?->reasons ?? [] as $reason) {
            $text = (string) ($reason['text'] ?? '');
            if (str_contains($text, 'El Nino') || str_contains($text, 'La Nina')) {
                $items[] = ['text' => $text, 'detail' => 'From this week\'s notebook update (NOAA index).', 'level' => 'aware'];
            }
        }

        return $items;
    }

    /**
     * Logged outside occurrences: active ones (still inside their briefing
     * window) plus the last 90 days of expired ones for reference.
     *
     * @return list<array<string, mixed>>
     */
    public static function external(?Carbon $today = null): array
    {
        $today ??= now('Asia/Manila')->startOfDay();
        $fleet = array_map([self::class, 'normalise'], Mishap::AIRCRAFT);
        $topCauses = Mishap::query()
            ->where('environment', Mishap::FLIGHT)
            ->whereNotNull('category')->where('category', '!=', HazardClassifier::OTHER)
            ->selectRaw('category, count(*) as c')->groupBy('category')->orderByDesc('c')
            ->limit(3)->pluck('category')->all();

        $rank = ['brief' => 0, 'aware' => 1, 'info' => 2];

        return ExternalOccurrence::query()
            ->whereDate('brief_until', '>=', $today->copy()->subDays(90)->toDateString())
            ->orderByDesc('occurred_on')->get()
            ->map(function (ExternalOccurrence $o) use ($fleet, $topCauses, $today) {
                $why = [];
                if ($o->aircraft && in_array(self::normalise($o->aircraft), $fleet, true)) {
                    $why[] = 'Our aircraft type';
                }
                if ($o->region === self::PRIORITY_REGION) {
                    $why[] = 'Mindanao';
                }
                if (in_array($o->category, $topCauses, true)) {
                    $why[] = 'One of our top causes';
                }

                return [
                    'id' => $o->id,
                    'occurred_on' => $o->occurred_on->format('Y-m-d'),
                    'display_date' => $o->occurred_on->format('d M Y'),
                    'region' => $o->region,
                    'region_label' => ExternalOccurrence::REGIONS[$o->region] ?? $o->region,
                    'location' => $o->location,
                    'aircraft' => $o->aircraft,
                    'category' => $o->category,
                    'summary' => $o->summary,
                    'source_url' => $o->source_url,
                    'brief_until' => $o->brief_until->format('Y-m-d'),
                    'display_until' => $o->brief_until->format('d M'),
                    'active' => $o->brief_until->gte($today),
                    'why' => $why,
                    'level' => count($why) >= 2 ? 'brief' : (count($why) === 1 ? 'aware' : 'info'),
                ];
            })
            ->sortBy(fn ($o) => [$o['active'] ? 0 : 1, $rank[$o['level']], -strtotime($o['occurred_on'])])
            ->values()->all();
    }

    /**
     * Completed Monday-to-Sunday weeks from $from (or the first record) up to
     * the week before $thisWeek, each flagged for what happened in it.
     *
     * @return list<array{start: Carbon, flight: bool, any: bool, bird: bool}>
     */
    private static function weeks(Carbon $thisWeek, ?Carbon $from = null): array
    {
        $records = Mishap::query()->get(['mishap_date', 'environment', 'category']);
        if ($records->isEmpty()) {
            return [];
        }

        $weekOf = fn ($d) => Carbon::parse($d)->startOfWeek()->toDateString();
        $flight = $records->where('environment', Mishap::FLIGHT)->map(fn ($m) => $weekOf($m->mishap_date))->flip();
        $any = $records->map(fn ($m) => $weekOf($m->mishap_date))->flip();
        $bird = $records->where('category', 'Bird / wildlife strike')->map(fn ($m) => $weekOf($m->mishap_date))->flip();

        $first = Carbon::parse($records->min('mishap_date'))->startOfWeek();
        $start = $from && $from->gt($first) ? $from->copy()->startOfWeek() : $first;

        $out = [];
        for ($w = $start->copy(); $w->lt($thisWeek); $w->addWeek()) {
            $key = $w->toDateString();
            $out[] = ['start' => $w->copy(), 'flight' => isset($flight[$key]), 'any' => isset($any[$key]), 'bird' => isset($bird[$key])];
        }

        return $out;
    }

    /** @return array{hits: int, weeks: int, pct: float} */
    private static function share(array $weeks, callable $hit): array
    {
        $hits = count(array_filter($weeks, $hit));

        return ['hits' => $hits, 'weeks' => count($weeks), 'pct' => round($hits / max(count($weeks), 1) * 100, 1)];
    }

    /**
     * How often something happened in weeks of the given months vs all other
     * weeks, over the whole record (per-cause counts are too small for 5 years).
     *
     * @param  list<int>  $months
     * @return array{hits: int, weeks: int, pct: float, other_hits: int, other_weeks: int, other_pct: float}
     */
    private static function seasonal(array $months, string $kind): array
    {
        $weeks = self::weeks(now('Asia/Manila')->startOfWeek());
        $in = array_values(array_filter($weeks, fn ($w) => in_array((int) $w['start']->month, $months, true)));
        $out = array_values(array_filter($weeks, fn ($w) => ! in_array((int) $w['start']->month, $months, true)));
        $a = self::share($in, fn ($w) => $w[$kind]);
        $b = self::share($out, fn ($w) => $w[$kind]);

        return $a + ['other_hits' => $b['hits'], 'other_weeks' => $b['weeks'], 'other_pct' => $b['pct']];
    }

    /**
     * A season's chance next to the rest of the year, with a plain verdict.
     * Fewer than 5 events is too little to call a difference; gaps under 2
     * points are "same as usual" — that's normal noise.
     *
     * @return array<string, mixed>
     */
    private static function compare(string $what, array $s, string $these): array
    {
        $gap = $s['pct'] - $s['other_pct'];

        return $s + [
            'what' => $what,
            'these' => $these,
            'verdict' => match (true) {
                $s['hits'] < 5 => 'too few to tell',
                abs($gap) < 2 => 'same as usual',
                $gap > 0 => 'higher than usual',
                default => 'lower than usual',
            },
        ];
    }

    /** "AW 109", "aw-109", "AW109" → "AW109" for matching against the fleet list. */
    private static function normalise(string $type): string
    {
        return strtoupper((string) preg_replace('/[^A-Za-z0-9]/', '', $type));
    }
}
