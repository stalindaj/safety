<?php

namespace App\Support;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * El Niño / La Niña from NOAA's Oceanic Niño Index (ONI): the official
 * 3-month running sea-surface temperature anomaly, published monthly by the
 * Climate Prediction Center. El Niño at +0.5 or more, La Niña at −0.5 or less.
 */
class Enso
{
    public const URL = 'https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt';

    private const CACHE_KEY = 'enso.oni';

    /** Middle month of each 3-month season ("DJF" = Dec–Feb, centred on January). */
    private const SEASON_MONTH = ['DJF' => 1, 'JFM' => 2, 'FMA' => 3, 'MAM' => 4, 'AMJ' => 5, 'MJJ' => 6,
        'JJA' => 7, 'JAS' => 8, 'ASO' => 9, 'SON' => 10, 'OND' => 11, 'NDJ' => 12];

    private const SEASON_LABEL = ['DJF' => 'Dec–Feb', 'JFM' => 'Jan–Mar', 'FMA' => 'Feb–Apr', 'MAM' => 'Mar–May',
        'AMJ' => 'Apr–Jun', 'MJJ' => 'May–Jul', 'JJA' => 'Jun–Aug', 'JAS' => 'Jul–Sep', 'ASO' => 'Aug–Oct',
        'SON' => 'Sep–Nov', 'OND' => 'Oct–Dec', 'NDJ' => 'Nov–Jan'];

    /**
     * "YYYY-MM" (the season's middle month) => anomaly, oldest first. Empty if
     * NOAA can't be reached. Cached for a day (it changes once a month).
     *
     * @return array<string, float>
     */
    public static function history(): array
    {
        if (is_array($cached = Cache::get(self::CACHE_KEY))) {
            return $cached['values'];
        }
        $data = self::fetch();
        Cache::put(self::CACHE_KEY, $data, $data['values'] ? 86400 : 3600);

        return $data['values'];
    }

    /** @return array{values: array<string, float>, latest: ?array{season: string, anomaly: float}} */
    public static function fetch(): array
    {
        try {
            $body = Http::connectTimeout(3)->timeout(8)
                ->withHeaders(['User-Agent' => '15SW-Safety/1.0 (Wing Safety Office dashboard)'])
                ->get(self::URL)->throw()->body();
        } catch (Throwable) {
            return ['values' => [], 'latest' => null];
        }

        return self::parse($body);
    }

    /** @return array{values: array<string, float>, latest: ?array{season: string, anomaly: float}} */
    public static function parse(string $body): array
    {
        $values = [];
        $latest = null;
        foreach (preg_split('/\R/', $body) as $line) {
            if (! preg_match('/^\s*([A-Z]{3})\s+(\d{4})\s+[-\d.]+\s+(-?\d+(?:\.\d+)?)\s*$/', $line, $m) || ! isset(self::SEASON_MONTH[$m[1]])) {
                continue;
            }
            // DJF 2026 is Dec 2025–Feb 2026, centred on Jan 2026: the year given is the middle month's year.
            $key = sprintf('%04d-%02d', (int) $m[2], self::SEASON_MONTH[$m[1]]);
            $values[$key] = (float) $m[3];
            $latest = ['season' => self::SEASON_LABEL[$m[1]].' '.$m[2], 'anomaly' => (float) $m[3]];
        }
        ksort($values);

        return ['values' => $values, 'latest' => $latest];
    }

    /** The latest reading, e.g. ['state' => 'el_nino', 'anomaly' => 1.8, 'season' => 'Jun–Aug 2026']. */
    public static function latest(): ?array
    {
        $values = self::history();
        if (! $values) {
            return null;
        }
        $key = array_key_last($values);
        $anomaly = $values[$key];
        [$year, $month] = array_map('intval', explode('-', $key));
        $season = array_search($month, self::SEASON_MONTH, true);

        return ['state' => self::state($anomaly), 'anomaly' => $anomaly, 'season' => self::SEASON_LABEL[$season].' '.$year];
    }

    /** The state in a given month, or null when that month has no reading. */
    public static function stateOn(Carbon $date, ?array $values = null): ?string
    {
        $values ??= self::history();
        $anomaly = $values[$date->format('Y-m')] ?? null;

        return $anomaly === null ? null : self::state($anomaly);
    }

    public static function state(float $anomaly): string
    {
        return $anomaly >= 0.5 ? 'el_nino' : ($anomaly <= -0.5 ? 'la_nina' : 'neutral');
    }

    public static function label(string $state): string
    {
        return ['el_nino' => 'El Niño', 'la_nina' => 'La Niña', 'neutral' => 'ENSO-neutral'][$state] ?? $state;
    }

    /** "moderate" etc., using NOAA's usual strength bands. */
    public static function strength(float $anomaly): string
    {
        $a = abs($anomaly);

        return match (true) {
            $a < 0.5 => 'neutral',
            $a < 1.0 => 'weak',
            $a < 1.5 => 'moderate',
            $a < 2.0 => 'strong',
            default => 'very strong',
        };
    }
}
