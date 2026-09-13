<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Occurrences OUTSIDE the Wing (other units, civil aviation, other areas)
     * logged by safety staff as early-warning advisories. They are never
     * counted in the SPI or the base rate — those stay 15SW-only.
     */
    public function up(): void
    {
        Schema::create('external_occurrences', function (Blueprint $table) {
            $table->id();
            $table->date('occurred_on');
            $table->string('region');                 // mindanao | visayas | luzon | outside
            $table->string('location');
            $table->string('aircraft')->nullable();   // matched against the 15SW fleet
            $table->string('category');               // same hazard categories as mishaps, plus Weather
            $table->text('summary');
            $table->string('source_url', 500)->nullable();
            $table->date('brief_until');              // advisory drops off the dashboard after this
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('brief_until');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('external_occurrences');
    }
};
