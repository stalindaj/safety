<?php

use App\Models\Mishap;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /** Rank scheme: EP (Amn-Sgt) | NCO (SSgt-CMS) | Officer | Civilian. */
    private const MAP = [
        'Lower Four' => 'EP',
        'Company Officer' => 'Officer',
        'Senior Officer' => 'Officer',
    ];

    public function up(): void
    {
        foreach (self::MAP as $old => $new) {
            Mishap::query()->where('rank_group', $old)->update(['rank_group' => $new]);
        }
    }

    public function down(): void
    {
        // Best-effort reverse (Officer collapses to Company Officer).
        Mishap::query()->where('rank_group', 'EP')->update(['rank_group' => 'Lower Four']);
        Mishap::query()->where('rank_group', 'Officer')->update(['rank_group' => 'Company Officer']);
    }
};
