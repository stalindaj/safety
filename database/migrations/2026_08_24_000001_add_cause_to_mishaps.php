<?php

use App\Models\Mishap;
use App\Support\HazardClassifier;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mishaps', function (Blueprint $table) {
            $table->string('cause')->nullable()->after('environment');
            $table->index('cause');
        });

        // Backfill existing records by inferring a cause from the description,
        // so the analysis is populated immediately (and never blank) on hosts
        // that already hold data.
        Mishap::query()->whereNull('cause')->chunkById(100, function ($rows) {
            foreach ($rows as $mishap) {
                $mishap->update(['cause' => HazardClassifier::primary($mishap->description)]);
            }
        });
    }

    public function down(): void
    {
        Schema::table('mishaps', function (Blueprint $table) {
            $table->dropIndex(['cause']);
            $table->dropColumn('cause');
        });
    }
};
