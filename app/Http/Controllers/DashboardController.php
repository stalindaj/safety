<?php

namespace App\Http\Controllers;

use App\Models\Mishap;
use App\Support\HazardClassifier;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(): Response
    {
        /** @var Collection<int, Mishap> $all */
        $all = Mishap::query()->get(['mishap_date', 'location', 'mishap_type', 'environment', 'cause', 'description']);

        $total = $all->count();
        $currentYear = (int) now()->year;
        $years = $all->map(fn (Mishap $m) => (int) $m->mishap_date->format('Y'))->unique()->sort()->values();

        $thisYear = $all->filter(fn (Mishap $m) => (int) $m->mishap_date->format('Y') === $currentYear);
        $hazards = $this->hazards($all, $total);
        $comparison = $this->comparison($all, $years, $currentYear);

        return Inertia::render('Dashboard', [
            'stats' => [
                'total' => $total,
                'ytd' => $thisYear->count(),
                'ytd_accidents' => $thisYear->where('mishap_type', Mishap::ACCIDENT)->count(),
                'ytd_top_location' => $this->topLocation($thisYear),
                'current_year' => $currentYear,
                'span' => $years->isEmpty() ? '—' : $years->first().'–'.$years->last(),
            ],
            'comparison' => $comparison,
            'findings' => $this->findings($all, $total, $hazards, $comparison),
            'hazards' => $hazards,
            'yearly_trend' => $this->yearlyTrend($all, $years),
            'environment_split' => [
                ['name' => 'Ground', 'key' => Mishap::GROUND, 'value' => $all->where('environment', Mishap::GROUND)->count()],
                ['name' => 'Flight', 'key' => Mishap::FLIGHT, 'value' => $all->where('environment', Mishap::FLIGHT)->count()],
            ],
            'monthly' => $this->monthly($all, $currentYear),
            'monthly_year' => $currentYear,
            'top_locations' => $this->topLocations($all),
            'all_locations' => $this->allLocations($all),
            'location_details' => $this->locationDetails($all),
            'unlocated' => $all->whereNull('location')->count(),
        ]);
    }

    // ── Plain-language layer ────────────────────────────────────────────────

    /**
     * Top causes inferred from the descriptions, biggest first, with share.
     * Every category is shown by name (there are only ~a dozen), so the reader
     * sees real causes like falls or kite strikes rather than a vague "Other".
     *
     * @return list<array{label: string, count: int, pct: int}>
     */
    private function hazards(Collection $all, int $total): array
    {
        if ($total === 0) {
            return [];
        }

        // Prefer the cause chosen/stored on each record; fall back to inferring
        // from the description only for anything not yet classified.
        $counts = $all
            ->groupBy(fn (Mishap $m) => $m->cause ?: HazardClassifier::primary($m->description))
            ->map->count()
            ->sortDesc();

        return $counts
            ->map(fn (int $count, string $label) => [
                'label' => $label,
                'count' => $count,
                'pct' => (int) round($count / $total * 100),
            ])
            ->values()
            ->all();
    }

    /**
     * Year-so-far against the previous full year — the comparison a commander
     * actually asks for.
     *
     * @return array{current_year: int, current_count: int, prev_year: int, prev_count: int, direction: string, delta_pct: int|null, peak_year: int|null, peak_count: int, avg_per_year: float}
     */
    private function comparison(Collection $all, Collection $years, int $currentYear): array
    {
        $byYear = $all->groupBy(fn (Mishap $m) => (int) $m->mishap_date->format('Y'))->map->count();

        $current = (int) ($byYear[$currentYear] ?? 0);
        $prev = (int) ($byYear[$currentYear - 1] ?? 0);

        $direction = $current === $prev ? 'same' : ($current > $prev ? 'up' : 'down');
        $deltaPct = $prev > 0 ? (int) round(($current - $prev) / $prev * 100) : null;

        $peakYear = $byYear->isEmpty() ? null : (int) $byYear->sortDesc()->keys()->first();

        return [
            'current_year' => $currentYear,
            'current_count' => $current,
            'prev_year' => $currentYear - 1,
            'prev_count' => $prev,
            'direction' => $direction,
            'delta_pct' => $deltaPct,
            'peak_year' => $peakYear,
            'peak_count' => $peakYear ? (int) $byYear[$peakYear] : 0,
            'avg_per_year' => $years->isEmpty() ? 0.0 : round($all->count() / $years->count(), 1),
        ];
    }

    /**
     * A handful of ready-to-read sentences. `tone` drives the icon/colour on
     * the front end: alert (watch out), info (neutral), good (reassuring).
     *
     * @param  list<array{label: string, count: int, pct: int}>  $hazards
     * @return list<array{text: string, tone: string}>
     */
    private function findings(Collection $all, int $total, array $hazards, array $comparison): array
    {
        if ($total === 0) {
            return [];
        }

        $findings = [];

        // 1. Leading cause.
        if ($top = $hazards[0] ?? null) {
            $findings[] = [
                'text' => "{$top['label']} is the leading cause of mishaps — {$top['count']} of {$total} records ({$top['pct']}%).",
                'tone' => 'alert',
            ];
        }

        // 2. Where mishaps happen — flight vs ground.
        $flight = $all->where('environment', Mishap::FLIGHT)->count();
        $ground = $total - $flight;
        if ($flight >= $ground && $ground > 0) {
            $pct = (int) round($flight / $total * 100);
            $findings[] = ['text' => "Flight operations account for {$pct}% of all mishaps ({$flight} of {$total}).", 'tone' => 'info'];
        } elseif ($ground > 0) {
            $pct = (int) round($ground / $total * 100);
            $findings[] = ['text' => "Ground activities account for {$pct}% of all mishaps ({$ground} of {$total}).", 'tone' => 'info'];
        }

        // 3. Severity — most are minor incidents, not accidents.
        $accidents = $all->where('mishap_type', Mishap::ACCIDENT)->count();
        $incidentPct = (int) round(($total - $accidents) / $total * 100);
        $findings[] = [
            'text' => "Most mishaps are minor: {$incidentPct}% were incidents; only {$accidents} were accidents.",
            'tone' => 'good',
        ];

        // 4. This year vs last year.
        if ($comparison['current_count'] > 0 && $comparison['prev_count'] > 0) {
            $c = $comparison;
            if ($c['direction'] === 'up') {
                $findings[] = ['text' => "So far in {$c['current_year']}: {$c['current_count']} mishaps — up from {$c['prev_count']} in all of {$c['prev_year']}.", 'tone' => 'alert'];
            } elseif ($c['direction'] === 'down') {
                $findings[] = ['text' => "So far in {$c['current_year']}: {$c['current_count']} mishaps — down from {$c['prev_count']} in all of {$c['prev_year']}.", 'tone' => 'good'];
            } else {
                $findings[] = ['text' => "So far in {$c['current_year']}: {$c['current_count']} mishaps — level with {$c['prev_year']}.", 'tone' => 'info'];
            }
        }

        // 5. Most affected location.
        if ($loc = $this->topLocation($all)) {
            $locCount = $all->where('location', $loc)->count();
            $pct = (int) round($locCount / $total * 100);
            $findings[] = ['text' => "{$loc} records the most mishaps — {$locCount} ({$pct}% of all locations).", 'tone' => 'info'];
        }

        return $findings;
    }

    // ── Chart data ──────────────────────────────────────────────────────────

    private function topLocation(Collection $set): ?string
    {
        return $set->whereNotNull('location')
            ->groupBy('location')
            ->map->count()
            ->sortDesc()
            ->keys()
            ->first();
    }

    /** Total mishaps per calendar year across the full history. */
    private function yearlyTrend(Collection $all, Collection $years): array
    {
        if ($years->isEmpty()) {
            return [];
        }

        $counts = $all->groupBy(fn (Mishap $m) => (int) $m->mishap_date->format('Y'))->map->count();

        return collect(range($years->first(), $years->last()))
            ->map(fn (int $y) => ['year' => (string) $y, 'total' => (int) ($counts[$y] ?? 0)])
            ->values()
            ->all();
    }

    /** Jan–Dec breakdown for a single calendar year. */
    private function monthly(Collection $all, int $year): array
    {
        $counts = $all
            ->filter(fn (Mishap $m) => (int) $m->mishap_date->format('Y') === $year)
            ->groupBy(fn (Mishap $m) => (int) $m->mishap_date->format('n'))
            ->map->count();

        return collect(range(1, 12))
            ->map(fn (int $m) => [
                'month' => Carbon::create(null, $m, 1)->format('M'),
                'total' => (int) ($counts[$m] ?? 0),
            ])
            ->all();
    }

    /** Top 5 locations by all-time mishap count. */
    private function topLocations(Collection $all): array
    {
        return array_slice($this->allLocations($all), 0, 5);
    }

    /**
     * Per-location mishap list (newest first) for the map click-through modal.
     *
     * @return array<string, list<array<string, mixed>>>
     */
    private function locationDetails(Collection $all): array
    {
        return $all->whereNotNull('location')
            ->sortByDesc('mishap_date')
            ->groupBy('location')
            ->map(fn (Collection $group) => $group->map(fn (Mishap $m) => [
                'date' => $m->mishap_date->format('d M Y'),
                'type' => $m->mishap_type,
                'environment' => $m->environment,
                'cause' => $m->cause,
                'description' => $m->description,
            ])->values()->all())
            ->all();
    }

    /** Every location by all-time mishap count, biggest first. */
    private function allLocations(Collection $all): array
    {
        return $all->whereNotNull('location')
            ->groupBy('location')
            ->map->count()
            ->sortDesc()
            ->map(fn (int $count, string $location) => ['location' => $location, 'total' => $count])
            ->values()
            ->all();
    }
}
