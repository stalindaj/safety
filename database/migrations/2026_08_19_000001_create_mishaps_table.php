<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mishaps', function (Blueprint $table) {
            $table->id();
            $table->date('mishap_date');
            $table->string('location')->nullable();

            // Classification captured on intake.
            $table->string('mishap_type')->default('incident'); // accident | incident
            $table->string('environment')->default('ground');   // ground | flight

            $table->text('description');

            // Filled in once the investigation closes. AI-assisted drafting is
            // planned; the columns exist now so nothing needs a re-migration.
            $table->text('corrective_action')->nullable();
            $table->text('lesson_learned')->nullable();

            $table->timestamps();

            $table->index('mishap_date');
            $table->index('mishap_type');
            $table->index('environment');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mishaps');
    }
};
