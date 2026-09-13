<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One scheduled aircraft-sortie, parsed from the nightly Flight Order PDF by
 * notebooks/parse_schedule.py. Read-only as far as the app is concerned.
 */
class FlightSchedule extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['flight_date' => 'date'];
    }
}
