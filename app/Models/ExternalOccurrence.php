<?php

namespace App\Models;

use App\Support\HazardClassifier;
use Illuminate\Database\Eloquent\Model;

/** An occurrence outside the Wing, logged as an early-warning advisory. */
class ExternalOccurrence extends Model
{
    public const REGIONS = [
        'mindanao' => 'Mindanao',
        'visayas' => 'Visayas',
        'luzon' => 'Luzon',
        'outside' => 'Outside the Philippines',
    ];

    /** Days an advisory stays on the dashboard unless a date is given. */
    public const DEFAULT_BRIEF_DAYS = 30;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'occurred_on' => 'date',
            'brief_until' => 'date',
        ];
    }

    /** @return list<string> */
    public static function categories(): array
    {
        return [...HazardClassifier::CATEGORIES, 'Weather'];
    }
}
