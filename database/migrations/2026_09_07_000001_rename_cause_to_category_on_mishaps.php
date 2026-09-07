<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mishaps', function (Blueprint $table) {
            $table->dropIndex(['cause']);
        });
        Schema::table('mishaps', function (Blueprint $table) {
            $table->renameColumn('cause', 'category');
        });
        Schema::table('mishaps', function (Blueprint $table) {
            $table->index('category');
        });
    }

    public function down(): void
    {
        Schema::table('mishaps', function (Blueprint $table) {
            $table->dropIndex(['category']);
        });
        Schema::table('mishaps', function (Blueprint $table) {
            $table->renameColumn('category', 'cause');
        });
        Schema::table('mishaps', function (Blueprint $table) {
            $table->index('cause');
        });
    }
};
