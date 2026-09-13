<?php

namespace App\Http\Controllers;

use App\Models\FlightSchedule;
use App\Models\Mishap;
use App\Models\SafetyForecast;
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
                ->get(['mishap_date', 'mishap_type', 'environment', 'category', 'aircraft'])
                ->map(fn (Mishap $m) => [
                    'mishap_date' => $m->mishap_date->format('Y-m-d'),
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
}
