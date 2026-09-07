<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Weekly safety-forecast results. The scoring model (offline Python) writes
     * one row per week; the app only READS the latest row to render the "This
     * Week — Safety Forecast" panel. No calculation happens in PHP.
     */
    public function up(): void
    {
        Schema::create('safety_forecasts', function (Blueprint $table) {
            $table->id();
            $table->date('week_start');                    // Monday of the forecast week
            $table->string('base')->nullable();            // null = wing-wide
            $table->string('risk_level');                  // low | moderate | elevated | high
            $table->unsignedTinyInteger('likelihood')->nullable(); // optional %, when exposure is known
            $table->string('headline')->nullable();        // one-line plain-language summary
            $table->json('reasons')->nullable();           // [{ text, tone }] plain-language drivers
            $table->string('source')->default('baseline'); // which model/version produced it
            $table->timestamp('generated_at')->nullable();
            $table->timestamps();

            $table->unique(['week_start', 'base']);
            $table->index('week_start');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('safety_forecasts');
    }
};
