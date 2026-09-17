<?php

namespace App\Models;

use Database\Factories\NewsDetectionFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One flying-related event from trusted sources (several articles grouped).
 * The watcher decides it automatically; a person can overrule.
 */
class NewsDetection extends Model
{
    /** @use HasFactory<NewsDetectionFactory> */
    use HasFactory;

    /** Only one newsroom so far: waiting for a second source. */
    public const WAITING = 'waiting';

    /** Verified, but not close enough to the Wing to log. */
    public const INFO = 'info';

    /** The model disagrees with the rules: a person should check. */
    public const PENDING = 'pending';

    /** Logged as an outside occurrence (automatically, or by a person). */
    public const CONFIRMED = 'confirmed';

    /** Removed by a person. */
    public const DISMISSED = 'dismissed';

    public const KINDS = [
        'accident' => 'Crash / accident',
        'incident' => 'Incident',
        'disruption' => 'Airport / flights disrupted',
        'hazard' => 'Flying hazard',
    ];

    public const REGIONS = [
        'mindanao' => 'Mindanao',
        'visayas' => 'Visayas',
        'luzon' => 'Luzon',
        'philippines' => 'Philippines',
        'nearby' => 'Nearby country',
        'outside' => 'Outside the Philippines',
    ];

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'occurred_on' => 'date',
            'reviewed_at' => 'datetime',
            'military' => 'boolean',
            'auto' => 'boolean',
            'why' => 'array',
            'score' => 'integer',
        ];
    }

    public function articles(): HasMany
    {
        return $this->hasMany(NewsArticle::class)->orderBy('published_at');
    }

    public function occurrence(): BelongsTo
    {
        return $this->belongsTo(ExternalOccurrence::class, 'external_occurrence_id');
    }
}
