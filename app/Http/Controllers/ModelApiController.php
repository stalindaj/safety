<?php

namespace App\Http\Controllers;

use App\Models\FlightSchedule;
use App\Models\Mishap;
use App\Models\MishapWeather;
use App\Models\SafetyForecast;
use App\Models\WatcherReport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * The forecast notebook's link to the app: it pulls the inputs it needs and
 * pushes back one wing-wide forecast row per week. Sends only the fields the
 * model uses — no descriptions, names, crew or itineraries.
 */
class ModelApiController extends Controller
{
    public function data(): JsonResponse
    {
        return response()->json([
            'generated_at' => now()->toIso8601String(),
            'mishaps' => Mishap::query()->orderBy('mishap_date')
                ->get(['id', 'mishap_date', 'mishap_time', 'location', 'mishap_type', 'environment', 'category', 'aircraft'])
                ->map(fn (Mishap $m) => [
                    'id' => $m->id,
                    'mishap_date' => $m->mishap_date->format('Y-m-d'),
                    // Time and place let the watcher notebook look up the weather.
                    'mishap_time' => $m->mishap_time,
                    'location' => $m->location,
                    'mishap_type' => $m->mishap_type,
                    'environment' => $m->environment,
                    'category' => $m->category,
                    'aircraft' => $m->aircraft,
                ]),
            'sorties' => FlightSchedule::query()->orderBy('flight_date')
                ->get(['flight_date'])
                ->map(fn (FlightSchedule $s) => ['flight_date' => $s->flight_date->format('Y-m-d')]),
        ]);
    }

    public function forecasts(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'source' => ['nullable', 'string', 'max:60'],
            // A calendar year plus up to 12 weeks ahead.
            'forecasts' => ['required', 'array', 'min:1', 'max:80'],
            'forecasts.*.week_start' => ['required', 'date_format:Y-m-d'],
            'forecasts.*.risk_level' => ['required', 'in:baseline,low,moderate,elevated,high'],
            'forecasts.*.likelihood' => ['nullable', 'integer', 'between:0,100'],
            'forecasts.*.baseline' => ['nullable', 'integer', 'between:0,100'],
            'forecasts.*.headline' => ['nullable', 'string', 'max:255'],
            'forecasts.*.reasons' => ['present', 'array', 'max:10'],
            'forecasts.*.reasons.*.text' => ['required', 'string', 'max:255'],
            'forecasts.*.reasons.*.tone' => ['required', 'string', 'max:20'],
            'forecasts.*.reasons.*.impact' => ['required', 'integer', 'between:0,100'],
        ]);

        $now = now();
        DB::transaction(function () use ($payload, $now) {
            foreach ($payload['forecasts'] as $f) {
                // One wing-wide row per week (base NULL): replace, don't pile up.
                SafetyForecast::whereNull('base')->whereDate('week_start', $f['week_start'])->delete();
                SafetyForecast::create([
                    'week_start' => $f['week_start'],
                    'base' => null,
                    'risk_level' => $f['risk_level'],
                    'likelihood' => $f['likelihood'] ?? null,
                    'baseline' => $f['baseline'] ?? null,
                    'headline' => $f['headline'] ?? null,
                    'reasons' => $f['reasons'],
                    'source' => $payload['source'] ?? 'notebook',
                    'generated_at' => $now,
                ]);
            }
        });

        return response()->json(['saved' => count($payload['forecasts'])]);
    }

    /**
     * The watcher notebook's weather check: the weather at the time and place
     * of every mishap, plus how often each hazard is present on mishap days
     * compared with ordinary days. Each run sends every mishap and replaces
     * the previous run.
     */
    public function weatherLinks(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'source' => ['nullable', 'string', 'max:60'],
            'summary' => ['required', 'array'],
            'summary.period' => ['nullable', 'string', 'max:60'],
            'summary.max_distance_km' => ['nullable', 'integer', 'between:1,500'],
            'summary.counts' => ['present', 'array'],
            'summary.counts.*' => ['integer', 'min:0'],
            'summary.unmapped' => ['present', 'array', 'max:200'],
            'summary.unmapped.*' => ['string', 'max:190'],
            'summary.rows' => ['present', 'array', 'max:40'],
            'summary.rows.*.group' => ['required', 'in:flight,all'],
            'summary.rows.*.hazard' => ['required', 'string', 'max:60'],
            'summary.rows.*.mishap_hits' => ['required', 'integer', 'min:0'],
            'summary.rows.*.mishap_days' => ['required', 'integer', 'min:0'],
            'summary.rows.*.mishap_pct' => ['required', 'numeric', 'between:0,100'],
            'summary.rows.*.usual_pct' => ['required', 'numeric', 'between:0,100'],
            'summary.rows.*.verdict' => ['required', 'in:higher than usual,lower than usual,same as usual,too few to tell'],
            'links' => ['present', 'array', 'max:5000'],
            'links.*.mishap_id' => ['required', 'integer'],
            'links.*.station' => ['nullable', 'string', 'max:8'],
            'links.*.station_name' => ['nullable', 'string', 'max:60'],
            'links.*.distance_km' => ['nullable', 'integer', 'between:0,5000'],
            'links.*.source' => ['required', 'in:observed,estimate,none'],
            'links.*.window' => ['required', 'in:day,time'],
            'links.*.level' => ['required', 'in:brief,aware,clear,no_data'],
            'links.*.hazards' => ['present', 'array', 'max:12'],
            'links.*.hazards.*.text' => ['required', 'string', 'max:80'],
            'links.*.hazards.*.level' => ['required', 'in:brief,aware'],
            'links.*.note' => ['nullable', 'string', 'max:190'],
            'links.*.reports' => ['nullable', 'integer', 'between:0,1000'],
        ]);

        $known = Mishap::query()->pluck('id')->flip();
        $links = collect($payload['links'])->filter(fn ($l) => isset($known[$l['mishap_id']]))->unique('mishap_id');

        DB::transaction(function () use ($payload, $links) {
            MishapWeather::query()->delete();
            foreach ($links as $l) {
                MishapWeather::create([
                    'mishap_id' => $l['mishap_id'],
                    'station' => $l['station'] ?? null,
                    'station_name' => $l['station_name'] ?? null,
                    'distance_km' => $l['distance_km'] ?? null,
                    'source' => $l['source'],
                    'window' => $l['window'],
                    'level' => $l['level'],
                    'hazards' => $l['hazards'],
                    'note' => $l['note'] ?? null,
                    'reports' => $l['reports'] ?? 0,
                ]);
            }
            WatcherReport::updateOrCreate(['kind' => WatcherReport::WEATHER_LINK], [
                'payload' => $payload['summary'],
                'source' => $payload['source'] ?? 'watcher notebook',
                'generated_at' => now(),
            ]);
        });

        return response()->json(['saved' => $links->count(), 'skipped' => count($payload['links']) - $links->count()]);
    }
}
