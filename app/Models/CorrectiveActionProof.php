<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

/** One proof file (photo or PDF) attached to a corrective action. */
class CorrectiveActionProof extends Model
{
    /** Proof files live on the private disk — never under public/. */
    public const DISK = 'local';

    protected $guarded = ['id'];

    protected static function booted(): void
    {
        static::deleted(fn (self $proof) => Storage::disk(self::DISK)->delete($proof->path));
    }

    /** Stored names keep the extension guessed from the file's content. */
    public function isPdf(): bool
    {
        return str_ends_with(strtolower($this->path), '.pdf');
    }

    public function correctiveAction(): BelongsTo
    {
        return $this->belongsTo(CorrectiveAction::class);
    }
}
