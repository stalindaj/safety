<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

/**
 * Full seed: the login account plus the complete CY 2016–2026 historical
 * mishap record. Loaded by /setup?demo=1 (or a plain first install).
 */
class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        $this->call([
            UserSeeder::class,
            MishapSeeder::class,
            CorrectiveActionSeeder::class,
        ]);
    }
}
