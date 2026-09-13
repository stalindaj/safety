<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('corrective_actions', function (Blueprint $table) {
            // The named person in the OPR/UPR who follows the action up.
            $table->string('follow_up_name')->nullable()->after('opr');
            $table->string('follow_up_contact', 40)->nullable()->after('follow_up_name');
            $table->string('follow_up_email')->nullable()->after('follow_up_contact');
            // Proof / intervention — what was actually done to comply.
            $table->text('intervention')->nullable()->after('staff_action');
        });

        // Proof photos (max 3 per action, enforced in the controller). Files sit on
        // the private `local` disk and are only served to signed-in users.
        Schema::create('corrective_action_proofs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('corrective_action_id')->constrained()->cascadeOnDelete();
            $table->string('path');
            $table->string('original_name')->nullable();
            $table->unsignedInteger('size')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('corrective_action_proofs');

        Schema::table('corrective_actions', function (Blueprint $table) {
            $table->dropColumn(['follow_up_name', 'follow_up_contact', 'follow_up_email', 'intervention']);
        });
    }
};
