<?php

namespace App\Http\Controllers;

use App\Models\CorrectiveAction;
use App\Models\Mishap;
use Inertia\Inertia;
use Inertia\Response;

/**
 * CAPS follow-through: every mishap with its corrective actions, so the page
 * can show a year's mishaps and roll the same actions up by the unit
 * (OPR/UPR) that owns them.
 */
class CapsController extends Controller
{
    public function __invoke(): Response
    {
        return Inertia::render('Caps', [
            'current_year' => (int) now()->year,
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
