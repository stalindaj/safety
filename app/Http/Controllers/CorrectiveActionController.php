<?php

namespace App\Http\Controllers;

use App\Models\CorrectiveAction;
use App\Models\Mishap;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class CorrectiveActionController extends Controller
{
    public function show(Mishap $mishap): Response
    {
        $mishap->load('correctiveActions');

        return Inertia::render('Mishaps/Plan', [
            'mishap' => [
                'id' => $mishap->id,
                'display_date' => $mishap->mishap_date->format('d M Y'),
                'location' => $mishap->location,
                'mishap_type' => $mishap->mishap_type,
                'environment' => $mishap->environment,
                'cause' => $mishap->cause,
                'description' => $mishap->description,
            ],
            'entries' => $mishap->correctiveActions->map(fn (CorrectiveAction $c) => $this->present($c)),
            'statuses' => CorrectiveAction::STATUSES,
        ]);
    }

    public function store(Request $request, Mishap $mishap): RedirectResponse
    {
        $mishap->correctiveActions()->create(
            $this->validated($request) + ['sort_order' => (int) $mishap->correctiveActions()->max('sort_order') + 1],
        );

        return back()->with('success', 'Corrective action added.');
    }

    public function update(Request $request, CorrectiveAction $correctiveAction): RedirectResponse
    {
        $correctiveAction->update($this->validated($request));

        return back()->with('success', 'Corrective action updated.');
    }

    public function destroy(CorrectiveAction $correctiveAction): RedirectResponse
    {
        $correctiveAction->delete();

        return back()->with('success', 'Corrective action removed.');
    }

    /** @return array<string, mixed> */
    private function validated(Request $request): array
    {
        return $request->validate([
            'latent_condition' => ['nullable', 'string'],
            'category' => ['nullable', 'string', 'max:190'],
            'cause_factor' => ['nullable', 'string', 'max:190'],
            'opr' => ['nullable', 'string', 'max:190'],
            'corrective_action' => ['required', 'string'],
            'staff_action' => ['nullable', 'string'],
            'status' => ['required', Rule::in(CorrectiveAction::STATUSES)],
            'remarks' => ['nullable', 'string'],
        ]);
    }

    /** @return array<string, mixed> */
    private function present(CorrectiveAction $c): array
    {
        return [
            'id' => $c->id,
            'latent_condition' => $c->latent_condition,
            'category' => $c->category,
            'cause_factor' => $c->cause_factor,
            'opr' => $c->opr,
            'corrective_action' => $c->corrective_action,
            'staff_action' => $c->staff_action,
            'status' => $c->status,
            'remarks' => $c->remarks,
        ];
    }
}
