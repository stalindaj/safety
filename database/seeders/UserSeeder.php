<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        // Superadmin — change this password from the profile screen the moment
        // you go live. Idempotent, so a re-seed never wipes a changed password.
        User::updateOrCreate(
            ['email' => 'superadmin@15sw.paf.mil.ph'],
            [
                'name' => 'Superadmin',
                'rank' => null,
                'password' => Hash::make('ChangeMe!2026'),
                'role' => 'admin',
            ],
        );

        // Simple demo login for presentations. REMOVE or change the password
        // before real/production use — "password" is not secure.
        User::updateOrCreate(
            ['email' => 'safety'],
            [
                'name' => 'Safety',
                'rank' => null,
                'password' => Hash::make('password'),
                'role' => 'admin',
            ],
        );
    }
}
