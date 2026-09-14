<?php

namespace App\Support;

use App\Models\Mishap;
use Illuminate\Support\Collection;

class SafetyPerformanceIndicator
{
    /** Rolling window (days) for the safety performance indicator. */
    public const WINDOW_DAYS = 90;

    /**
     * Safety Performance Indicator, per ICAO Doc 9859 (SMM, 4th ed) §4.4.5
     * "Safety triggers": trigger levels are set from the population standard
     * deviation (STDEVP) of the preceding historical data points, added to the
     * mean. We track a rolling 90-day mishap count, sampled weekly.
     *
     * This DETECTS an abnormal rate — it does not predict individual events.
     *
     * @param  Collection<int, Mishap>  $all
     * @return array<string, mixed>
     */
    public static function build(Collection $all): array
    {
        $stamps = $all->map(fn (Mishap $m) => $m->mishap_date->timestamp)->sort()->values();
        if ($stamps->count() < 2) {
            return ['series' => [], 'mean' => 0, 'sd' => 0, 'levels' => [], 'current' => 0,
                'status' => 'normal', 'breaches' => [], 'window_days' => self::WINDOW_DAYS];
        }

        $window = self::WINDOW_DAYS * 86400;
        $start = $stamps->first() + $window;   // first full window
        $end = now()->timestamp;

        $series = [];
        for ($t = $start; $t <= $end; $t += 7 * 86400) {
            $from = $t - $window;
            $series[] = [
                'date' => date('Y-m-d', $t),
                'value' => $stamps->filter(fn ($s) => $s > $from && $s <= $t)->count(),
            ];
        }
        if ($series === []) {
            return ['series' => [], 'mean' => 0, 'sd' => 0, 'levels' => [], 'current' => 0,
                'status' => 'normal', 'breaches' => [], 'window_days' => self::WINDOW_DAYS];
        }

        $values = array_column($series, 'value');
        $n = count($values);
        $mean = array_sum($values) / $n;
        // Population SD (STDEVP), as ICAO specifies.
        $sd = sqrt(array_sum(array_map(fn ($v) => ($v - $mean) ** 2, $values)) / $n);

        $levels = [
            'mean' => round($mean, 1),
            'caution' => round($mean + $sd, 1),
            'alert' => round($mean + 2 * $sd, 1),
            'critical' => round($mean + 3 * $sd, 1),
        ];

        $current = (int) end($values);
        $status = match (true) {
            $current >= $levels['critical'] => 'critical',
            $current >= $levels['alert'] => 'alert',
            $current >= $levels['caution'] => 'caution',
            default => 'normal',
        };

        // Group consecutive weeks at/above the alert level into periods.
        $breaches = [];
        $run = null;
        foreach ($series as $point) {
            if ($point['value'] >= $levels['alert']) {
                $run ??= ['from' => $point['date'], 'to' => $point['date'], 'peak' => 0];
                $run['to'] = $point['date'];
                $run['peak'] = max($run['peak'], $point['value']);
            } elseif ($run) {
                $breaches[] = $run;
                $run = null;
            }
        }
        if ($run) {
            $breaches[] = $run;
        }

        return [
            'series' => $series,
            'mean' => round($mean, 1),
            'sd' => round($sd, 1),
            'levels' => $levels,
            'current' => $current,
            'status' => $status,
            'breaches' => array_reverse($breaches),
            'window_days' => self::WINDOW_DAYS,
        ];
    }
}
