<?php

namespace App\Support;

use App\Models\ExternalOccurrence;
use App\Models\NewsDetection;
use App\Models\WatcherReport;
use Illuminate\Support\Carbon;

/**
 * Turns the plain chances (how often it happened, last 5 years) into this
 * week's chances by letting the current conditions contribute: time of year,
 * El Niño / La Niña, airfield weather, and occurrences outside the Wing.
 *
 * Method (a Bayesian update, the same idea used in medical test results):
 *   odds this week = base odds × factor₁ × factor₂ × …
 * Each factor is measured from the Wing's own record — how much more (or
 * less) often it went wrong under that condition — and then pulled toward
 * 1.0 ("no effect") in proportion to how little evidence there is, so a
 * handful of weeks can't swing the number. A factor with no history yet
 * contributes nothing and says so. The total change is capped at ×0.5–×2.
 *
 * Factors overlap somewhat (El Niño and the dry season, say), so treat the
 * result as a careful adjustment, not a precise forecast.
 */
class ChanceModel
{
    /** Shrinkage strength: a condition's rate counts as if mixed with this many "average" weeks. */
    public const PRIOR_WEEKS = 52;

    /** Same, for day-level weather evidence (mishap days). */
    public const PRIOR_DAYS = 50;

    public const MIN_TOTAL = 0.5;

    public const MAX_TOTAL = 2.0;

    /** Outside occurrences start counting once the watcher has this much history. */
    public const OUTSIDE_MIN_WEEKS = 26;

    /** An outside occurrence counts toward the next 14 days. */
    public const OUTSIDE_DAYS = 14;

    /**
     * @param  array<string, mixed>  $odds  EarlyWarning::odds()
     * @param  array<string, mixed>  $weather  AirfieldWeather::snapshot()
     * @return array<string, mixed>
     */
    public static function adjust(array $odds, array $weather, ?Carbon $today = null): array
    {
        if (! isset($odds['flight_week'])) {
            return $odds;
        }
        $today ??= now('Asia/Manila');
        $weeks = EarlyWarning::weeks($today->copy()->startOfWeek());
        $oni = Enso::history();
        $link = WatcherReport::query()->firstWhere('kind', WatcherReport::WEATHER_LINK)?->payload;

        foreach (['flight_week' => 'flight', 'any_week' => 'any', 'bird_week' => 'bird'] as $tile => $outcome) {
            $factors = [];
            $factors[] = self::timeOfYear($weeks, $outcome, $today);
            $factors[] = self::enso($weeks, $outcome, $oni);
            if ($outcome !== 'bird') {
                $factors[] = self::weather($weather, $link, $outcome);
            }
            $factors[] = self::outside($weeks, $outcome, $today);

            $odds[$tile] = self::combine($odds[$tile], $factors);
        }

        return $odds;
    }

    /**
     * Apply the factors to a base chance, one after another, recording how
     * many percentage points each one moved it.
     *
     * @param  array<string, mixed>  $base  ['pct' => 10.3, ...]
     * @param  list<array<string, mixed>>  $factors
     * @return array<string, mixed>
     */
    public static function combine(array $base, array $factors): array
    {
        $p = max(0.001, min(0.999, $base['pct'] / 100));
        $odds = $p / (1 - $p);
        $total = 1.0;
        $used = [];
        $pending = [];

        foreach ($factors as $f) {
            if ($f['multiplier'] === null) {
                $pending[] = ['label' => $f['label'], 'why' => $f['detail']];

                continue;
            }
            $next = max(self::MIN_TOTAL, min(self::MAX_TOTAL, $total * $f['multiplier']));
            $before = $odds * $total / (1 + $odds * $total);
            $after = $odds * $next / (1 + $odds * $next);
            $total = $next;
            $used[] = $f + ['points' => round(($after - $before) * 100, 1)];
        }

        $pct = $odds * $total / (1 + $odds * $total) * 100;

        return [
            ...$base,
            'base_pct' => $base['pct'],
            'pct' => round($pct, 1),
            'multiplier' => round($total, 2),
            'factors' => $used,
            'pending' => $pending,
        ];
    }

    /**
     * How much a weekly condition changed the chance, from the whole record,
     * shrunk toward no effect.
     *
     * @param  list<array<string, mixed>>  $weeks
     * @return array{multiplier: float, raw: ?float, hits: int, weeks: int, rate: float, usual: float}
     */
    public static function weeklyEffect(array $weeks, string $outcome, callable $inCondition): array
    {
        $all = count($weeks);
        $allHits = count(array_filter($weeks, fn ($w) => $w[$outcome]));
        $in = array_values(array_filter($weeks, $inCondition));
        $n = count($in);
        $hits = count(array_filter($in, fn ($w) => $w[$outcome]));
        $usual = $all ? $allHits / $all : 0.0;
        if (! $all || $usual <= 0) {
            return ['multiplier' => 1.0, 'raw' => null, 'hits' => $hits, 'weeks' => $n, 'rate' => 0.0, 'usual' => 0.0];
        }
        $shrunk = ($hits + self::PRIOR_WEEKS * $usual) / ($n + self::PRIOR_WEEKS);

        return [
            'multiplier' => $shrunk / $usual,
            'raw' => $n ? ($hits / $n) / $usual : null,
            'hits' => $hits,
            'weeks' => $n,
            'rate' => $n ? $hits / $n : 0.0,
            'usual' => $usual,
        ];
    }

    /** @param  list<array<string, mixed>>  $weeks */
    private static function timeOfYear(array $weeks, string $outcome, Carbon $today): array
    {
        $month = (int) $today->month;
        if ($outcome === 'bird') {
            [$label, $months] = match (true) {
                in_array($month, [9, 10, 11], true) => ['Bird migration, southbound (Sep–Nov)', [9, 10, 11]],
                in_array($month, [2, 3, 4, 5], true) => ['Bird migration, northbound (Feb–May)', [2, 3, 4, 5]],
                default => ['Outside bird migration months', [1, 6, 7, 8, 12]],
            };
        } else {
            [$label, $months] = match (true) {
                in_array($month, [6, 7, 8, 9], true) => ['Southwest monsoon (Habagat, Jun–Sep)', [6, 7, 8, 9]],
                in_array($month, [11, 12, 1, 2], true) => ['Northeast monsoon (Amihan, Nov–Feb)', [11, 12, 1, 2]],
                in_array($month, [3, 4, 5], true) => ['Pre-monsoon (Mar–May)', [3, 4, 5]],
                default => ['Monsoon transition (October)', [10]],
            };
        }
        $e = self::weeklyEffect($weeks, $outcome, fn ($w) => in_array((int) $w['start']->month, $months, true));

        return self::factor('season', $label, $e,
            sprintf('%s in %d of %d such weeks (%s) vs %s of all weeks since %d', self::what($outcome), $e['hits'], $e['weeks'],
                self::pct($e['rate']), self::pct($e['usual']), self::since($weeks)));
    }

    /**
     * @param  list<array<string, mixed>>  $weeks
     * @param  array<string, float>  $oni
     */
    private static function enso(array $weeks, string $outcome, array $oni): array
    {
        $latest = Enso::latest();
        if (! $latest) {
            return ['key' => 'enso', 'label' => 'El Niño / La Niña', 'multiplier' => null,
                'detail' => 'NOAA\'s index couldn\'t be reached, so it isn\'t counted this time.'];
        }
        $state = $latest['state'];
        $known = array_values(array_filter($weeks, fn ($w) => Enso::stateOn($w['start'], $oni) !== null));
        $e = self::weeklyEffect($known, $outcome, fn ($w) => Enso::stateOn($w['start'], $oni) === $state);
        $label = Enso::label($state).($state === 'neutral' ? '' : ', '.Enso::strength($latest['anomaly']))
            .sprintf(' (ONI %+.1f, %s)', $latest['anomaly'], $latest['season']);

        return self::factor('enso', $label, $e,
            sprintf('%s in %d of %d %s weeks (%s) vs %s of all weeks since %d · NOAA ONI', self::what($outcome), $e['hits'], $e['weeks'],
                Enso::label($state), self::pct($e['rate']), self::pct($e['usual']), self::since($known)));
    }

    /**
     * Airfield weather now / next 24 h. Measured at day level by the watcher
     * notebook (bad weather on mishap days vs ordinary days at the same
     * airfields), used here as a likelihood ratio.
     *
     * @param  array<string, mixed>  $weather
     * @param  array<string, mixed>|null  $link
     */
    private static function weather(array $weather, ?array $link, string $outcome): array
    {
        $label = 'Airfield weather (now and next 24 h)';
        if (! ($weather['available'] ?? false)) {
            return ['key' => 'weather', 'label' => $label, 'multiplier' => null,
                'detail' => 'Live airfield weather couldn\'t be reached, so it isn\'t counted this time.'];
        }
        $group = $outcome === 'flight' ? 'flight' : 'all';
        $row = collect($link['rows'] ?? [])->first(fn ($r) => $r['group'] === $group && $r['hazard'] === 'Any brief-level weather');
        if (! $row || ! $row['mishap_days']) {
            return ['key' => 'weather', 'label' => $label, 'multiplier' => null,
                'detail' => 'Not measured yet: run the weather watcher notebook to learn how weather relates to our mishaps.'];
        }

        $bad = collect($weather['stations'] ?? [])->where('level', 'brief')->pluck('name')->values();
        $present = $bad->isNotEmpty();
        $m = $row['mishap_pct'] / 100;
        $u = max(0.001, min(0.999, $row['usual_pct'] / 100));
        $raw = $present ? $m / $u : (1 - $m) / (1 - $u);
        $n = (int) $row['mishap_days'];
        $multiplier = ($n * $raw + self::PRIOR_DAYS) / ($n + self::PRIOR_DAYS);

        return [
            'key' => 'weather',
            'label' => $present ? 'Bad weather reported or forecast: '.$bad->implode(', ') : 'No bad weather at our airfields',
            'multiplier' => round($multiplier, 3),
            'raw' => round($raw, 2),
            'detail' => sprintf('Bad weather was on %s of our %s days vs %s of ordinary days at the same airfields (%d days measured)%s',
                self::pct($m), $group === 'flight' ? 'flight mishap' : 'mishap', self::pct($u), $n,
                $present && $raw < 1 ? '. It runs lower on bad-weather days, most likely because flying stops in bad weather' : ''),
        ];
    }

    /** @param  list<array<string, mixed>>  $weeks */
    private static function outside(array $weeks, string $outcome, Carbon $today): array
    {
        $label = 'Occurrences outside the Wing (last 14 days)';
        $first = collect([
            ExternalOccurrence::query()->min('occurred_on'),
            NewsDetection::query()->min('occurred_on'),
        ])->filter()->map(fn ($d) => Carbon::parse($d))->min();
        $recent = ExternalOccurrence::query()
            ->whereDate('occurred_on', '>=', $today->copy()->subDays(self::OUTSIDE_DAYS)->toDateString())
            ->whereDate('occurred_on', '<=', $today->toDateString())
            ->count();
        $history = $first ? (int) floor($first->diffInWeeks($today->copy()->startOfWeek())) : 0;

        if ($history < self::OUTSIDE_MIN_WEEKS) {
            return ['key' => 'outside', 'label' => $label, 'multiplier' => null,
                'detail' => sprintf('Not counted yet: needs %d weeks of logged outside occurrences to measure the effect (%d so far).%s',
                    self::OUTSIDE_MIN_WEEKS, max(0, $history), $recent ? " {$recent} logged in the last 14 days." : '')];
        }

        $dates = ExternalOccurrence::query()->pluck('occurred_on')->map(fn ($d) => Carbon::parse($d));
        $watched = array_values(array_filter($weeks, fn ($w) => $w['start']->gte($first)));
        $hasRecent = fn ($w) => $dates->contains(fn (Carbon $d) => $d->lt($w['start']) && $d->gte($w['start']->copy()->subDays(self::OUTSIDE_DAYS)));
        $e = $recent
            ? self::weeklyEffect($watched, $outcome, $hasRecent)
            : self::weeklyEffect($watched, $outcome, fn ($w) => ! $hasRecent($w));

        return self::factor('outside', $recent ? "{$recent} outside occurrence".($recent === 1 ? '' : 's').' logged in the last 14 days' : 'No outside occurrences in the last 14 days', $e,
            sprintf('%s in %d of %d such weeks (%s) vs %s, since the watcher started', self::what($outcome), $e['hits'], $e['weeks'],
                self::pct($e['rate']), self::pct($e['usual'])));
    }

    /** @param  array<string, mixed>  $e */
    private static function factor(string $key, string $label, array $e, string $detail): array
    {
        return [
            'key' => $key,
            'label' => $label,
            'multiplier' => round($e['multiplier'], 3),
            'raw' => $e['raw'] === null ? null : round($e['raw'], 2),
            'detail' => $detail,
        ];
    }

    /** @param  list<array<string, mixed>>  $weeks */
    private static function since(array $weeks): int
    {
        return $weeks ? (int) $weeks[0]['start']->year : (int) now()->year;
    }

    private static function what(string $outcome): string
    {
        return ['flight' => 'A flight mishap', 'any' => 'A mishap', 'bird' => 'A bird / wildlife strike'][$outcome];
    }

    private static function pct(float $share): string
    {
        return round($share * 100).'%';
    }
}
