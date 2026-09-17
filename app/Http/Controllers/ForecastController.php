<?php

namespace App\Http\Controllers;

use App\Models\CorrectiveAction;
use App\Models\Mishap;
use App\Models\SafetyForecast;
use App\Support\EarlyWarning;
use App\Support\News\NewsWatcher;
use App\Support\SafetyPerformanceIndicator;
use Inertia\Inertia;
use Inertia\Response;

use function Illuminate\Support\defer;

/**
 * The Safety Forecast page: the weekly base rate written by the Colab
 * notebook, the SPI (rolling 90-day count vs ICAO trigger levels), and the
 * experimental Predictive Safety Forecast (weather, season, outside
 * occurrences). Displays only — no scoring happens here.
 */
class ForecastController extends Controller
{
    public function __invoke(): Response
    {
        $all = Mishap::query()
            ->with('correctiveActions:id,mishap_id,cause_factor,latent_condition,sort_order')
            ->orderByDesc('mishap_date')
            ->get(['id', 'mishap_date', 'location', 'mishap_type', 'environment', 'category', 'aircraft', 'phase',
                'description', 'lesson_learned']);

        $years = $all->map(fn (Mishap $m) => (int) $m->mishap_date->format('Y'))->unique()->sort()->values();

        // Backup for the cron job: if the news hasn't been checked in the last
        // hour, check after this page is sent, so it never slows the page down.
        if (config('services.news_watch.auto') && NewsWatcher::due()) {
            defer(fn () => NewsWatcher::run(), 'news-watcher');
        }

        // The whole wing-wide series, so the week-changer works client-side.
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

        return Inertia::render('Forecast', [
            // Past mishaps in the viewed calendar week, listed under the base rate.
            'records' => $all->map(fn (Mishap $m) => [
                'id' => $m->id,
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
                'description' => $m->description,
                // Causes come from the board's CAPS: the cause factor and the gap behind it.
                'causes' => $m->correctiveActions
                    ->map(fn (CorrectiveAction $c) => [
                        'factor' => trim((string) $c->cause_factor) ?: null,
                        'detail' => trim((string) $c->latent_condition) ?: null,
                    ])
                    ->filter(fn ($c) => $c['factor'] || $c['detail'])
                    ->unique(fn ($c) => $c['factor'].'|'.$c['detail'])
                    ->values(),
                'lesson_learned' => trim((string) $m->lesson_learned) ?: null,
            ])->values(),
            'years' => $years,
            'today' => now()->format('Y-m-d'),
            'risk_forecasts' => $forecasts,
            // Rolling 90-day count against ICAO trigger levels — is the rate abnormal right now?
            'spi' => SafetyPerformanceIndicator::build($all),
            // Signals that can come before a mishap (weather, season, outside occurrences).
            'early_warning' => EarlyWarning::build(),
        ]);
    }
}
