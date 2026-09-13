<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Nightly flight schedule (Flight Order) lines, one row per aircraft-sortie.
     * This is the EXPOSURE source the risk model was missing: how much flying is
     * planned, on which tails, at what time of day.
     */
    public function up(): void
    {
        Schema::create('flight_schedules', function (Blueprint $table) {
            $table->id();
            $table->date('flight_date');
            $table->string('category');              // directed | training | night | maintenance
            $table->string('aircraft')->nullable();  // e.g. AW-109, SF-260TP
            $table->string('tail')->nullable();      // e.g. 823
            $table->text('crew')->nullable();
            $table->string('etd', 8)->nullable();    // HHMM as flown/ordered
            $table->unsignedSmallInteger('etd_minutes')->nullable(); // minutes past midnight
            $table->string('itinerary')->nullable();
            $table->string('mission')->nullable();
            $table->string('source_file')->nullable();
            $table->timestamps();

            $table->unique(['flight_date', 'tail', 'etd'], 'flight_schedules_unique_sortie');
            $table->index('flight_date');
            $table->index('aircraft');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('flight_schedules');
    }
};
