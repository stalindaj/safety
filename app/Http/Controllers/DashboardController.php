<?php

namespace App\Http\Controllers;

use App\Models\CorrectiveAction;
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
            ->get(['mishap_date', 'location', 'mishap_type', 'environment', 'category',
                'aircraft', 'phase', 'mission', 'qualification', 'vehicle_type', 'rank_group', 'description']);

        $years = $all->map(fn (Mishap $m) => (int) $m->mishap_date->format('Y'))->unique()->sort()->values();

        // Forecasts (weekly base rate, Predictive Safety Forecast) live on the
        // Forecast page; the dashboard is analytics of what has happened.
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
