<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('corrective_actions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('mishap_id')->constrained()->cascadeOnDelete();

            // One row of the Corrective Action Plan (mirrors CAPS.xlsx columns).
            $table->text('latent_condition')->nullable();   // gap
            $table->string('category')->nullable();         // DOTMPLF
            $table->string('cause_factor')->nullable();     // Human/Org/Environmental/Material × Primary/Contributory
            $table->string('opr')->nullable();              // office/unit of primary responsibility
            $table->text('corrective_action');
            $table->text('staff_action')->nullable();       // milestone
            $table->string('status')->default('pending');   // complied | ongoing | pending | approved | as_required
            $table->text('remarks')->nullable();            // raw status text
            $table->unsignedInteger('sort_order')->default(0);

            $table->timestamps();

            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('corrective_actions');
    }
};
