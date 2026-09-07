<?php

namespace App\Http\Controllers;

use App\Models\Mishap;
use App\Models\SafetyForecast;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
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
            ->get(['mishap_date', 'location', 'mishap_type', 'environment', 'category', 'description']);

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
                'description' => $m->description,
            ])->values(),
            'current_year' => (int) now()->year,
            'years' => $years,
            'span' => $years->isEmpty() ? '—' : $years->first().'–'.$years->last(),
            'today' => now()->format('Y-m-d'),
            'risk_forecasts' => $forecasts,
        ]);
    }
}
