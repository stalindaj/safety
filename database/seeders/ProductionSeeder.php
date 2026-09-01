<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * The production baseline for a live install.
 *
 * Seeds the login account (you cannot get in otherwise) plus the CY 2016–2026
 * historical mishap record — real reference data the office already keeps, not
 * throwaway samples. Both seeders are idempotent, so a re-run never duplicates.
 */
class ProductionSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            UserSeeder::class,
            MishapSeeder::class,
            CorrectiveActionSeeder::class,
        ]);
    }
}
