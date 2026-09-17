<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Optional time of the mishap: lets the watcher read the weather at that hour, not the whole day.
        Schema::table('mishaps', function (Blueprint $table) {
            $table->string('mishap_time', 5)->nullable()->after('mishap_date'); // "HH:MM", Philippine time
        });

        // The weather at the time and place of each mishap, from the watcher notebook.
        Schema::create('mishap_weather', function (Blueprint $table) {
            $table->id();
            $table->foreignId('mishap_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('station', 8)->nullable();         // ICAO id of the airfield report used
            $table->string('station_name', 60)->nullable();
            $table->unsignedSmallInteger('distance_km')->nullable();
            $table->string('source', 12);                     // observed | estimate | none
            $table->string('window', 8)->default('day');      // day | time (±2 h of the mishap time)
            $table->string('level', 10);                      // brief | aware | clear | no_data
            $table->json('hazards');
            $table->string('note', 190)->nullable();
            $table->unsignedSmallInteger('reports')->default(0);
            $table->timestamps();
        });

        // Summaries the watcher notebook sends back (one row per kind, replaced each run).
        Schema::create('watcher_reports', function (Blueprint $table) {
            $table->id();
            $table->string('kind', 40)->unique();
            $table->json('payload');
            $table->string('source', 60)->nullable();
            $table->timestamp('generated_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('watcher_reports');
        Schema::dropIfExists('mishap_weather');
        Schema::table('mishaps', function (Blueprint $table) {
            $table->dropColumn('mishap_time');
        });
    }
};
