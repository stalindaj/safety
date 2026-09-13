<?php

namespace App\Support;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Live airfield weather where 15SW flies: the latest METAR (now) and TAF
 * (roughly the next 24 hours) from the public API of the US NOAA Aviation
 * Weather Center. Read once per 30 minutes and cached; if the service can't be
 * reached, the dashboard says so instead of implying "all clear".
 */
class AirfieldWeather
{
    private const URL = 'https://aviationweather.gov/api/data';

    private const CACHE_KEY = 'airfield-weather';

    /** Reporting airports nearest the Wing's sites — Mindanao first. */
    public const STATIONS = [
        'RPMZ' => ['name' => 'Zamboanga', 'serves' => 'EAAB · TOG 9 · Jolo area', 'region' => 'Mindanao'],
        'RPMR' => ['name' => 'General Santos', 'serves' => 'TOG 12 area', 'region' => 'Mindanao'],
        'RPMD' => ['name' => 'Davao', 'serves' => 'Davao area', 'region' => 'Mindanao'],
        'RPVM' => ['name' => 'Mactan-Cebu', 'serves' => 'Visayas · nearest report to TOG 8', 'region' => 'Visayas'],
        'RPLL' => ['name' => 'Manila', 'serves' => 'MDAAB · Sangley', 'region' => 'Luzon'],
    ];

    /** Sites with no live report in this feed, shown so nobody reads silence as "clear". */
    public const NOT_COVERED = 'No live report for Lumbia / Cagayan de Oro (TOG 10, LAB): Laguindingan and Lumbia don\'t publish to this feed.';

    /** @return array<string, mixed> */
    public static function snapshot(): array
    {
        if ($cached = Cache::get(self::CACHE_KEY)) {
            return $cached;
        }

        $data = self::fetch();
        Cache::put(self::CACHE_KEY, $data, $data['available'] ? 1800 : 900);

        return $data;
    }

    /** @return array<string, mixed> */
    public static function fetch(): array
    {
        $ids = implode(',', array_keys(self::STATIONS));

        try {
            $client = Http::connectTimeout(3)->timeout(6)
                ->withHeaders(['User-Agent' => '15SW-Safety/1.0 (Wing Safety Office dashboard)']);
            $metars = collect($client->get(self::URL.'/metar', ['ids' => $ids, 'format' => 'json'])->throw()->json() ?? [])
                ->keyBy('icaoId');
            $tafs = collect($client->get(self::URL.'/taf', ['ids' => $ids, 'format' => 'json'])->throw()->json() ?? [])
                ->keyBy('icaoId');
        } catch (Throwable) {
            return ['available' => false, 'stations' => [], 'not_covered' => self::NOT_COVERED,
                'checked_at' => now()->format('d M H:i')];
        }

        $stations = [];
        foreach (self::STATIONS as $id => $info) {
            $m = $metars->get($id);
            $t = $tafs->get($id);

            $now = $m ? self::hazards((string) ($m['rawOb'] ?? ''), $m['wxString'] ?? null, $m['visib'] ?? null,
                $m['wspd'] ?? null, $m['wgst'] ?? null) : [];

            $next = [];
            if ($t) {
                foreach ($t['fcsts'] ?? [] as $f) {
                    array_push($next, ...self::hazards('', $f['wxString'] ?? null, $f['visib'] ?? null,
                        $f['wspd'] ?? null, $f['wgst'] ?? null));
                }
                // "TEMPO … FEW015CB" is in most tropical forecasts: worth knowing, not a
                // reason to brief on its own (thunderstorms forecast as TS are).
                if (! in_array('Thunderstorms', array_column($next, 'text'), true)
                    && preg_match('/\dCB\b/', (string) ($t['rawTAF'] ?? ''))) {
                    $next[] = ['text' => 'CB clouds expected at times', 'level' => 'aware'];
                }
                $next = self::unique($next);
            }

            $ageHours = $m ? (int) floor((now()->timestamp - (int) $m['obsTime']) / 3600) : null;

            $stations[] = $info + [
                'id' => $id,
                'reporting' => (bool) $m,
                'observed' => $m ? Carbon::createFromTimestamp($m['obsTime'], 'Asia/Manila')->format('d M H:i') : null,
                // Some airports don't report overnight; flag reports over 3 hours old.
                'stale' => $ageHours !== null && $ageHours >= 3,
                'age_hours' => $ageHours,
                'forecast_until' => $t ? Carbon::createFromTimestamp($t['validTimeTo'], 'Asia/Manila')->format('d M H:i') : null,
                'now' => $now,
                'next' => $next,
                'raw' => $m['rawOb'] ?? null,
                'raw_taf' => $t['rawTAF'] ?? null,
                'level' => self::worst([...$now, ...$next], $m ? 'clear' : 'info'),
            ];
        }

        return ['available' => true, 'stations' => $stations, 'not_covered' => self::NOT_COVERED,
            'checked_at' => now()->format('d M H:i')];
    }

    /**
     * Plain-language hazards from one observation or forecast period.
     * Visibility is in statute miles ("6+" = 10 km or more); wind in knots.
     *
     * @return list<array{text: string, level: string}>
     */
    public static function hazards(string $raw, ?string $wx, mixed $visib, mixed $wspd, mixed $wgst): array
    {
        $raw = ' '.strtoupper($raw).' ';
        $wx = strtoupper((string) $wx);
        $out = [];

        // Thunderstorm or lightning = brief. Cumulonimbus cloud alone = be aware.
        if (str_contains($wx, 'TS') || preg_match('/\bLTG/', $raw)) {
            $out[] = ['text' => 'Thunderstorms', 'level' => 'brief'];
        } elseif (preg_match('/\dCB\b|\bCB\b/', $raw)) {
            $out[] = ['text' => 'CB clouds nearby', 'level' => 'aware'];
        }
        if (is_numeric($visib) && (float) $visib < 3) {
            $out[] = ['text' => sprintf('Low visibility (%.1f km)', (float) $visib * 1.609), 'level' => 'brief'];
        }
        if ((int) $wgst >= 25) {
            $out[] = ['text' => "Gusts {$wgst} kt", 'level' => 'brief'];
        } elseif ((int) $wspd >= 20) {
            $out[] = ['text' => "Strong wind {$wspd} kt", 'level' => 'aware'];
        }
        if (preg_match('/HZ|FU|BR|FG/', $wx)) {
            $out[] = ['text' => 'Haze / mist / smoke', 'level' => 'aware'];
        }
        if (preg_match('/RA|SH/', $wx) && ! str_contains($wx, 'TS')) {
            $out[] = ['text' => 'Rain / showers', 'level' => 'aware'];
        }

        return $out;
    }

    /** @param list<array{text: string, level: string}> $items */
    private static function unique(array $items): array
    {
        return array_values(collect($items)->unique('text')->all());
    }

    /** @param list<array{level: string}> $items */
    private static function worst(array $items, string $fallback): string
    {
        $levels = array_column($items, 'level');

        return match (true) {
            in_array('brief', $levels, true) => 'brief',
            in_array('aware', $levels, true) => 'aware',
            default => $fallback,
        };
    }
}
