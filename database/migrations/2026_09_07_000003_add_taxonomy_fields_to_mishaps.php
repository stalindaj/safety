<?php

use App\Models\Mishap;
use App\Support\MishapAttributes;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mishaps', function (Blueprint $table) {
            // Flight taxonomy
            $table->string('aircraft')->nullable()->after('category');
            $table->string('phase')->nullable()->after('aircraft');       // Take-off | Cruise | Landing | Ground
            $table->string('mission')->nullable()->after('phase');         // Training | Combat | ... (capture going forward)
            $table->string('qualification')->nullable()->after('mission'); // PIC/Wingman | ... (capture going forward)
            // Ground taxonomy
            $table->string('vehicle_type')->nullable()->after('qualification'); // POV 2-wheel | POV 4-wheel | PATMV
            // Both
            $table->string('rank_group')->nullable()->after('vehicle_type');    // Lower Four | NCO | Officer tiers | Civilian

            $table->index('aircraft');
            $table->index('phase');
            $table->index('vehicle_type');
        });

        // Backfill from the free-text description (best effort).
        Mishap::query()->chunkById(100, function ($rows) {
            foreach ($rows as $m) {
                $update = ['rank_group' => MishapAttributes::rankGroup($m->description)];
                if ($m->environment === Mishap::FLIGHT) {
                    $update['aircraft'] = MishapAttributes::aircraft($m->description);
                    $update['phase'] = MishapAttributes::phase($m->description);
                } else {
                    $update['vehicle_type'] = MishapAttributes::vehicleType($m->description);
                }
                $m->update(array_filter($update, fn ($v) => $v !== null));
            }
        });
    }

    public function down(): void
    {
        Schema::table('mishaps', function (Blueprint $table) {
            $table->dropIndex(['aircraft']);
            $table->dropIndex(['phase']);
            $table->dropIndex(['vehicle_type']);
            $table->dropColumn(['aircraft', 'phase', 'mission', 'qualification', 'vehicle_type', 'rank_group']);
        });
    }
};
