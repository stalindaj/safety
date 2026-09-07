<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A precomputed weekly safety-forecast result. Populated by the offline scoring
 * model; the dashboard only reads it. See the create_safety_forecasts migration.
 */
class SafetyForecast extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'week_start' => 'date',
            'reasons' => 'array',
            'generated_at' => 'datetime',
        ];
    }
}
