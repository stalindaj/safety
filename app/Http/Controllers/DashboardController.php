<?php

namespace App\Http\Controllers;

use App\Models\CorrectiveAction;
use App\Models\Mishap;
use App\Models\SafetyForecast;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /** Rolling window (days) for the safety performance indicator. */
    private const SPI_WINDOW = 90;

    /**
     * Safety Performance Indicator, per ICAO Doc 9859 (SMM, 4th ed) §4.4.5
     * "Safety triggers": trigger levels are set from the population standard
     * deviation (STDEVP) of the preceding historical data points, added to the
     * mean. We track a rolling 90-day mishap count, sampled weekly.
     *
     * This DETECTS an abnormal rate — it does not predict individual events.
     *
     * @param  \Illuminate\Support\Collection<int, Mishap>  $all
     * @return array<string, mixed>
     */
    private function spi($all): array
    {
        $stamps = $all->map(fn (Mishap $m) => $m->mishap_date->timestamp)->sort()->values();
        if ($stamps->count() < 2) {
            return ['series' => [], 'mean' => 0, 'sd' => 0, 'levels' => [], 'current' => 0,
                'status' => 'normal', 'breaches' => [], 'window_days' => self::SPI_WINDOW];
        }

        $window = self::SPI_WINDOW * 86400;
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
                'status' => 'normal', 'breaches' => [], 'window_days' => self::SPI_WINDOW];
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
            'window_days' => self::SPI_WINDOW,
        ];
    }

    /**
     * The dashboard is a client-side BI view: we hand the browser the raw
     * records (only ~hundreds) and it computes every tile/chart itself, so
     * clicking Accident/Incident or Ground/Flight re-filters instantly with no
     * round-trip.
     */
    public function __invoke(): Response
    {
        $all = Mishap::query()
            ->orderByDesc('mishap_date')
            ->get(['mishap_date', 'location', 'mishap_type', 'environment', 'category',
                'aircraft', 'phase', 'mission', 'qualification', 'vehicle_type', 'rank_group', 'description']);

        $years = $all->map(fn (Mishap $m) => (int) $m->mishap_date->format('Y'))->unique()->sort()->values();

        // Precomputed weekly forecasts written by the offline scoring model.
        // The dashboard only displays them — no scoring happens here. We hand the
        // browser the whole wing-wide series so the week-changer and the "risk
        // across the year" chart work client-side.
        $forecasts = SafetyForecast::query()
            ->whereNull('base')
            ->orderBy('week_start')
            ->orderByDesc('generated_at')
            ->orderByDesc('id')
            ->get()
            ->unique(fn (SafetyForecast $f) => $f->week_start->format('Y-m-d'))
            ->map(fn (SafetyForecast $f) => [
                'week_start' => $f->week_start->format('Y-m-d'),
                'risk_level' => $f->risk_level,
                'likelihood' => $f->likelihood,
                'baseline' => $f->baseline,
                'headline' => $f->headline,
                'reasons' => $f->reasons ?? [],
                'source' => $f->source,
                'generated_at' => optional($f->generated_at)->format('d M Y'),
            ])
            ->values();

        return Inertia::render('Dashboard', [
            'records' => $all->map(fn (Mishap $m) => [
                'date' => $m->mishap_date->format('Y-m-d'),
                'display_date' => $m->mishap_date->format('d M Y'),
                'year' => (int) $m->mishap_date->format('Y'),
                'month' => (int) $m->mishap_date->format('n'),
                'day' => (int) $m->mishap_date->format('j'),
                'location' => $m->location,
                'type' => $m->mishap_type,
                'environment' => $m->environment,
                'category' => $m->category,
                'aircraft' => $m->aircraft,
                'phase' => $m->phase,
                'mission' => $m->mission,
                'qualification' => $m->qualification,
                'vehicle_type' => $m->vehicle_type,
                'rank_group' => $m->rank_group,
                'description' => $m->description,
            ])->values(),
            'current_year' => (int) now()->year,
            'years' => $years,
            'span' => $years->isEmpty() ? '—' : $years->first().'–'.$years->last(),
            'today' => now()->format('Y-m-d'),
            'risk_forecasts' => $forecasts,
            'spi' => $this->spi($all),
            // CAPS follow-through: every mishap with its corrective actions, so the
            // dashboard can show a year's mishaps and roll the same actions up by
            // the unit (OPR/UPR) that owns them.
            'caps' => Mishap::query()
                ->with(['correctiveActions' => fn ($q) => $q->withCount('proofs')])
                ->orderByDesc('mishap_date')
                ->get()
                ->map(fn (Mishap $m) => [
                    'id' => $m->id,
                    'year' => (int) $m->mishap_date->format('Y'),
                    'display_date' => $m->mishap_date->format('d M Y'),
                    'location' => $m->location,
                    'type' => $m->mishap_type,
                    'environment' => $m->environment,
                    'description' => $m->description,
                    'actions' => $m->correctiveActions->map(fn (CorrectiveAction $c) => [
                        'unit' => trim((string) $c->opr) ?: null,
                        'status' => $c->status,
                        'follow_up' => $c->follow_up_name,
                        'proof' => $c->proofs_count > 0,
                    ])->values(),
                ])
                ->values(),
        ]);
    }
}
