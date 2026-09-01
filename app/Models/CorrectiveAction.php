<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CorrectiveAction extends Model
{
    /** Status values (from the plan's REMARKS column). */
    public const STATUSES = ['complied', 'ongoing', 'pending', 'approved', 'as_required'];

    protected $guarded = ['id'];

    public function mishap(): BelongsTo
    {
        return $this->belongsTo(Mishap::class);
    }
}
