<?php

namespace App\Http\Controllers;

use App\Models\Mishap;
use App\Support\HazardClassifier;
use App\Support\MishapAttributes;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class MishapController extends Controller
{
    private const PER_PAGE = 15;

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
            'category' => in_array($request->input('category'), HazardClassifier::CATEGORIES, true) ? $request->input('category') : null,
            'search' => trim((string) $request->input('search')) ?: null,
        ];

        $filtered = fn () => Mishap::query()
            ->when($filters['year'], fn ($q, $year) => $q->forYear($year))
            ->when($filters['type'], fn ($q, $type) => $q->where('mishap_type', $type))
            ->when($filters['environment'], fn ($q, $env) => $q->where('environment', $env))
            ->when($filters['category'], fn ($q, $category) => $q->where('category', $category))
            ->when($filters['search'], fn ($q, $term) => $q->where(
                fn ($w) => $w->where('description', 'like', "%{$term}%")
                    ->orWhere('location', 'like', "%{$term}%"),
            ));

        // ?focus={id} (links from the dashboard / forecast): open the page that
        // holds that record so the table can scroll to and highlight its row.
        $focus = $request->integer('focus') ?: null;
        $page = null;
        if ($focus && ! $request->has('page') && ($target = $filtered()->find($focus))) {
            $date = $target->getRawOriginal('mishap_date');
            $before = $filtered()->where(fn ($q) => $q->where('mishap_date', '>', $date)
                ->orWhere(fn ($same) => $same->where('mishap_date', $date)->where('id', '>', $target->id)))
                ->count();
            $page = intdiv($before, self::PER_PAGE) + 1;
        }

        $mishaps = $filtered()
            ->with('correctiveActions')
            ->withCount('correctiveActions')
            ->latestFirst()
            ->paginate(self::PER_PAGE, ['*'], 'page', $page)
            ->withQueryString()
            ->through(fn (Mishap $m) => $this->present($m));

        return Inertia::render('Mishaps/Index', [
            'mishaps' => $mishaps,
            'filters' => $filters,
            'focus' => $focus,
            'years' => $years,
            'options' => [
                'types' => Mishap::TYPES,
                'environments' => Mishap::ENVIRONMENTS,
                'categories' => HazardClassifier::CATEGORIES,
                'aircraft' => Mishap::AIRCRAFT,
                'phases' => Mishap::PHASES,
                'missions' => Mishap::MISSIONS,
                'qualifications' => Mishap::QUALIFICATIONS,
                'vehicle_types' => Mishap::VEHICLE_TYPES,
                'rank_groups' => Mishap::RANK_GROUPS,
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
            'category' => ['nullable', Rule::in(HazardClassifier::CATEGORIES)],
            'aircraft' => ['nullable', Rule::in(Mishap::AIRCRAFT)],
            'phase' => ['nullable', Rule::in(Mishap::PHASES)],
            'mission' => ['nullable', Rule::in(Mishap::MISSIONS)],
            'qualification' => ['nullable', Rule::in(Mishap::QUALIFICATIONS)],
            'vehicle_type' => ['nullable', Rule::in(Mishap::VEHICLE_TYPES)],
            'rank_group' => ['nullable', Rule::in(Mishap::RANK_GROUPS)],
            'description' => ['required', 'string'],
            'corrective_action' => ['nullable', 'string'],
            'lesson_learned' => ['nullable', 'string'],
        ]);

        // Left on "auto-detect"? Infer from the description so the record is
        // never blank and the analysis stays complete.
        if (empty($data['category'])) {
            $data['category'] = HazardClassifier::primary($data['description']);
        }
        if (empty($data['rank_group'])) {
            $data['rank_group'] = MishapAttributes::rankGroup($data['description']);
        }
        if (($data['environment'] ?? null) === Mishap::FLIGHT) {
            $data['aircraft'] = $data['aircraft'] ?: MishapAttributes::aircraft($data['description']);
            $data['phase'] = $data['phase'] ?: MishapAttributes::phase($data['description']);
        } elseif (empty($data['vehicle_type'])) {
            $data['vehicle_type'] = MishapAttributes::vehicleType($data['description']);
        }

        return $data;
    }

    /** @return array<string, mixed> */
    private function present(Mishap $m): array
    {
        $caps = $m->relationLoaded('correctiveActions') ? $m->correctiveActions : collect();

        return [
            'id' => $m->id,
            'mishap_date' => $m->mishap_date->format('Y-m-d'),
            'display_date' => $m->mishap_date->format('d M Y'),
            'location' => $m->location,
            'mishap_type' => $m->mishap_type,
            'environment' => $m->environment,
            'category' => $m->category,
            'aircraft' => $m->aircraft,
            'phase' => $m->phase,
            'mission' => $m->mission,
            'qualification' => $m->qualification,
            'vehicle_type' => $m->vehicle_type,
            'rank_group' => $m->rank_group,
            'description' => $m->description,
            'corrective_action' => $m->corrective_action,
            'lesson_learned' => $m->lesson_learned,
            'cap_count' => $m->corrective_actions_count ?? 0,
            // Causal factors + CAPS compliance roll-up, shown on the records table.
            'causal_factors' => $caps->pluck('cause_factor')->filter()->unique()->values()->all(),
            'caps_summary' => $caps->groupBy('status')->map->count(),
            'caps_open' => $caps->where('status', '!=', 'complied')->map(fn ($c) => [
                'status' => $c->status,
                'opr' => $c->opr,
                'follow_up' => $c->follow_up_name,
                'action' => $c->corrective_action,
            ])->values()->all(),
        ];
    }
}
