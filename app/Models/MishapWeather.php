<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The weather at the time and place of one mishap, filled in by the watcher
 * notebook: "observed" = a real airfield report nearby, "estimate" = a weather
 * model where no airfield reports. Weather being present is not a finding of
 * cause — the safety board decides that.
 */
class MishapWeather extends Model
{
    protected $table = 'mishap_weather';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'hazards' => 'array',
            'distance_km' => 'integer',
            'reports' => 'integer',
        ];
    }

    public function mishap(): BelongsTo
    {
        return $this->belongsTo(Mishap::class);
    }
}
