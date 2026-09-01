<?php

namespace App\Http\Controllers;

use App\Models\Mishap;
use App\Support\HazardClassifier;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class MishapController extends Controller
{
    public function index(Request $request): Response
    {
        // Only ~hundreds of rows: derive the year list in PHP so it works the
        // same on SQLite (local) and MySQL (prod) without date-function quirks.
        $years = Mishap::query()
            ->orderByDesc('mishap_date')
            ->pluck('mishap_date')
            ->map(fn ($d) => (int) $d->format('Y'))
            ->unique()
            ->values();

        $filters = [
            'year' => $request->integer('year') ?: null,
            'type' => in_array($request->input('type'), Mishap::TYPES, true) ? $request->input('type') : null,
            'environment' => in_array($request->input('environment'), Mishap::ENVIRONMENTS, true) ? $request->input('environment') : null,
            'cause' => in_array($request->input('cause'), HazardClassifier::CATEGORIES, true) ? $request->input('cause') : null,
            'search' => trim((string) $request->input('search')) ?: null,
        ];

        $mishaps = Mishap::query()
            ->withCount('correctiveActions')
            ->latestFirst()
            ->when($filters['year'], fn ($q, $year) => $q->forYear($year))
            ->when($filters['type'], fn ($q, $type) => $q->where('mishap_type', $type))
            ->when($filters['environment'], fn ($q, $env) => $q->where('environment', $env))
            ->when($filters['cause'], fn ($q, $cause) => $q->where('cause', $cause))
            ->when($filters['search'], fn ($q, $term) => $q->where(
                fn ($w) => $w->where('description', 'like', "%{$term}%")
                    ->orWhere('location', 'like', "%{$term}%"),
            ))
            ->paginate(15)
            ->withQueryString()
            ->through(fn (Mishap $m) => $this->present($m));

        return Inertia::render('Mishaps/Index', [
            'mishaps' => $mishaps,
            'filters' => $filters,
            'years' => $years,
            'options' => [
                'types' => Mishap::TYPES,
                'environments' => Mishap::ENVIRONMENTS,
                'causes' => HazardClassifier::CATEGORIES,
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        Mishap::create($this->validated($request));

        return back()->with('success', 'Mishap record added.');
    }

    public function update(Request $request, Mishap $mishap): RedirectResponse
    {
        $mishap->update($this->validated($request));

        return back()->with('success', 'Mishap record updated.');
    }

    public function destroy(Mishap $mishap): RedirectResponse
    {
        $mishap->delete();

        return back()->with('success', 'Mishap record deleted.');
    }

    /** @return array<string, mixed> */
    private function validated(Request $request): array
    {
        $data = $request->validate([
            'mishap_date' => ['required', 'date'],
            'location' => ['nullable', 'string', 'max:190'],
            'mishap_type' => ['required', Rule::in(Mishap::TYPES)],
            'environment' => ['required', Rule::in(Mishap::ENVIRONMENTS)],
            'cause' => ['nullable', Rule::in(HazardClassifier::CATEGORIES)],
            'description' => ['required', 'string'],
            'corrective_action' => ['nullable', 'string'],
            'lesson_learned' => ['nullable', 'string'],
        ]);

        // Left on "auto-detect"? Infer the cause from the description so the
        // record is never blank and the analysis stays complete.
        if (empty($data['cause'])) {
            $data['cause'] = HazardClassifier::primary($data['description']);
        }

        return $data;
    }

    /** @return array<string, mixed> */
    private function present(Mishap $m): array
    {
        return [
            'id' => $m->id,
            'mishap_date' => $m->mishap_date->format('Y-m-d'),
            'display_date' => $m->mishap_date->format('d M Y'),
            'location' => $m->location,
            'mishap_type' => $m->mishap_type,
            'environment' => $m->environment,
            'cause' => $m->cause,
            'description' => $m->description,
            'corrective_action' => $m->corrective_action,
            'lesson_learned' => $m->lesson_learned,
            'cap_count' => $m->corrective_actions_count ?? 0,
        ];
    }
}
