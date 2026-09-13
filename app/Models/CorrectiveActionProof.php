<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

/** One proof photo attached to a corrective action. */
class CorrectiveActionProof extends Model
{
    /** Proof files live on the private disk — never under public/. */
    public const DISK = 'local';

    protected $guarded = ['id'];

    protected static function booted(): void
    {
        static::deleted(fn (self $proof) => Storage::disk(self::DISK)->delete($proof->path));
    }

    public function correctiveAction(): BelongsTo
    {
        return $this->belongsTo(CorrectiveAction::class);
    }
}
