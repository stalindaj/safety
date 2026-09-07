<?php

namespace Database\Seeders;

use App\Models\SafetyForecast;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

/**
 * Seeds ONE example forecast for the current week so the dashboard panel has
 * something to render before the offline scoring model is wired up. The plain-
 * language wording here is a placeholder — the Python model overwrites this row
 * with real values. Marked source="sample" so it is obviously not yet a model.
 */
class SafetyForecastSeeder extends Seeder
{
    public function run(): void
    {
        SafetyForecast::updateOrCreate(
            ['week_start' => Carbon::now()->startOfWeek()->toDateString(), 'base' => null],
            [
                'risk_level' => 'elevated',
                'likelihood' => 27,
                'headline' => 'Elevated risk this week — brief crews before flying and driving.',
                'reasons' => [
                    ['text' => 'Weather looks bad — low visibility and haze reported at Sangley.', 'tone' => 'alert'],
                    ['text' => 'Habagat (rainy) season, when mishaps are historically more common.', 'tone' => 'info'],
                    ['text' => 'Bird-strike season is active — watch take-offs and landings.', 'tone' => 'alert'],
                    ['text' => 'Recent activity is higher than usual for this time of year.', 'tone' => 'info'],
                ],
                'source' => 'sample',
                'generated_at' => Carbon::now(),
            ],
        );
    }
}
