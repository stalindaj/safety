<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The news watcher: flying-related occurrences from trusted sources,
     * grouped into one detection per event and decided automatically (logged,
     * for information, or waiting for a second source). Staff can undo or log
     * anyway; those decisions are the labels the relevance model learns from.
     */
    public function up(): void
    {
        Schema::create('news_detections', function (Blueprint $table) {
            $table->id();
            $table->date('occurred_on');                    // earliest report of the event
            $table->string('headline', 300);
            $table->string('kind', 12);                     // accident | incident | disruption | hazard
            $table->string('region', 12)->nullable();       // mindanao | visayas | luzon | philippines | nearby | outside
            $table->string('place', 80)->nullable();
            $table->string('aircraft', 60)->nullable();     // type named in the news
            $table->string('fleet_type', 20)->nullable();   // one of our types, when it matches
            $table->boolean('military')->default(false);
            $table->string('category', 60);
            $table->json('why');                            // rule reasons it matters to the Wing
            $table->unsignedTinyInteger('score')->default(0);
            $table->string('trust', 12)->nullable();         // official | aviation | outlets | single
            // Decided by the watcher: confirmed (logged) | info | waiting (1 source) | pending (a person should check);
            // by staff: confirmed | dismissed.
            $table->string('status', 10)->default('waiting');
            $table->boolean('auto')->default(true);          // false once a person has decided (the model learns from those)
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->foreignId('external_occurrence_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();

            $table->index(['status', 'occurred_on']);
        });

        Schema::create('news_articles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('news_detection_id')->constrained()->cascadeOnDelete();
            $table->char('guid_hash', 40)->unique();        // sha1 of the feed guid: never stored twice
            $table->string('title', 400);
            $table->string('source', 120)->nullable();
            $table->string('domain', 120);                  // the trusted outlet it came from
            $table->string('tier', 10);                     // official | aviation | news
            $table->string('url', 1000);
            $table->timestamp('published_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('news_articles');
        Schema::dropIfExists('news_detections');
    }
};
