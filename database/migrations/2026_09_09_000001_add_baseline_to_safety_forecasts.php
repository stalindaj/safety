<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The historical base rate (% of weeks with a mishap) that the week's
     * calibrated probability is compared against, so the dashboard can say
     * "18% this week vs 9% in a normal week" instead of a bare number.
     */
    public function up(): void
    {
        Schema::table('safety_forecasts', function (Blueprint $table) {
            $table->unsignedTinyInteger('baseline')->nullable()->after('likelihood');
        });
    }

    public function down(): void
    {
        Schema::table('safety_forecasts', function (Blueprint $table) {
            $table->dropColumn('baseline');
        });
    }
};
