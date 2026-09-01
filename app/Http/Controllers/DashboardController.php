<?php

namespace App\Http\Controllers;

use App\Models\Mishap;
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
            ->get(['mishap_date', 'location', 'mishap_type', 'environment', 'cause', 'description']);

        $years = $all->map(fn (Mishap $m) => (int) $m->mishap_date->format('Y'))->unique()->sort()->values();

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
                'cause' => $m->cause,
                'description' => $m->description,
            ])->values(),
            'current_year' => (int) now()->year,
            'years' => $years,
            'span' => $years->isEmpty() ? '—' : $years->first().'–'.$years->last(),
            'today' => now()->format('Y-m-d'),
        ]);
    }
}
