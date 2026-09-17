<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** A summary sent by the watcher notebook; one row per kind, replaced on each run. */
class WatcherReport extends Model
{
    public const WEATHER_LINK = 'weather_link';

    public const NEWS = 'news';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'generated_at' => 'datetime',
        ];
    }
}
