<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

class CorrectiveAction extends Model
{
    public const COMPLIED = 'complied';

    /** Status values (from the plan's REMARKS column). */
    public const STATUSES = [self::COMPLIED, 'ongoing', 'pending', 'approved', 'as_required'];

    /** Proof photos allowed per action. */
    public const MAX_PROOFS = 3;

    protected $guarded = ['id'];

    protected static function booted(): void
    {
        // The DB cascade removes the proof rows; this removes their files too.
        static::deleting(fn (self $action) => Storage::disk(CorrectiveActionProof::DISK)
            ->deleteDirectory($action->proofDirectory()));
    }

    public function mishap(): BelongsTo
    {
        return $this->belongsTo(Mishap::class);
    }

    public function proofs(): HasMany
    {
        return $this->hasMany(CorrectiveActionProof::class)->orderBy('id');
    }

    public function proofDirectory(): string
    {
        return "caps/{$this->id}";
    }
}
