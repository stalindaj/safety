<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Mishap extends Model
{
    /** @use HasFactory<\Database\Factories\MishapFactory> */
    use HasFactory;

    public const ACCIDENT = 'accident';

    public const INCIDENT = 'incident';

    public const EVENT = 'event';

    public const GROUND = 'ground';

    public const FLIGHT = 'flight';

    /** Allowed values, reused by validation and the front end. */
    public const TYPES = [self::ACCIDENT, self::INCIDENT, self::EVENT];

    public const ENVIRONMENTS = [self::GROUND, self::FLIGHT];

    // Deeper taxonomy option lists (reused by validation and the intake form).
    public const AIRCRAFT = ['OV-10', 'A-29B ST', 'SF-260TP', 'T-129 ATAK', 'AW-109', 'MD-520MG', 'MD-500ER'];

    public const PHASES = ['Take-off', 'Cruise', 'Landing', 'Ground'];

    public const MISSIONS = ['Training', 'Test Flight', 'Combat', 'Admin', 'Combat Support'];

    public const QUALIFICATIONS = [
        'Crew Chief', 'Armament', 'QA', 'Copilot/Pilot Gunner', 'PIC/Wingman',
        'Elemental Lead', 'Test Pilot', 'Instructor Pilot', 'Flight Commander', 'Flight Examiner',
    ];

    public const VEHICLE_TYPES = ['POV 2-wheel', 'POV 4-wheel', 'PATMV'];

    public const RANK_GROUPS = ['EP', 'NCO', 'Officer', 'Civilian'];

    protected $guarded = ['id'];

    protected static function booted(): void
    {
        // Delete CAPS through Eloquent so their proof photos leave the disk too
        // (the DB cascade alone would orphan the files).
        static::deleting(fn (Mishap $mishap) => $mishap->correctiveActions()->get()->each->delete());
    }

    protected function casts(): array
    {
        return [
            'mishap_date' => 'date',
        ];
    }

    /** The Corrective Action Plan — one row per gap/action, in plan order. */
    public function correctiveActions(): HasMany
    {
        return $this->hasMany(CorrectiveAction::class)->orderBy('sort_order');
    }

    /** Newest first — the order the records table expects. */
    public function scopeLatestFirst(Builder $query): Builder
    {
        return $query->orderByDesc('mishap_date')->orderByDesc('id');
    }

    public function scopeForYear(Builder $query, int $year): Builder
    {
        return $query->whereYear('mishap_date', $year);
    }
}
