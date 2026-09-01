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

    public const GROUND = 'ground';

    public const FLIGHT = 'flight';

    /** Allowed values, reused by validation and the front end. */
    public const TYPES = [self::ACCIDENT, self::INCIDENT];

    public const ENVIRONMENTS = [self::GROUND, self::FLIGHT];

    protected $guarded = ['id'];

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
