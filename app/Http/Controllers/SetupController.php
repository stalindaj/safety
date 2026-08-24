<?php

namespace App\Http\Controllers;

use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\ProductionSeeder;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schema;

/**
 * One-time installer for hosts with no SSH: run migrations (and the first seed)
 * from the browser. Guarded by SETUP_TOKEN, which must be blanked afterwards.
 */
class SetupController extends Controller
{
    public function __invoke(Request $request, string $token): Response
    {
        $expected = (string) config('app.setup_token');

        abort_if($expected === '', 404);
        abort_unless(hash_equals($expected, $token), 404);

        $output = [];

        Artisan::call('migrate', ['--force' => true]);
        $output[] = trim(Artisan::output());

        // Both seeders load the login account and the historical mishap record;
        // they are the same real baseline. DatabaseSeeder is kept for parity
        // with local dev / demo runs (?demo=1).
        $seederClass = $request->boolean('demo') ? DatabaseSeeder::class : ProductionSeeder::class;

        // Seed a virgin install automatically; otherwise require ?seed=1 so a
        // reload never wipes real data. (Seeders are idempotent regardless.)
        $freshInstall = Schema::hasTable('users') && User::count() === 0;
        $shouldSeed = $freshInstall || $request->boolean('seed') || $request->boolean('demo');

        if ($shouldSeed) {
            Artisan::call('db:seed', ['--class' => $seederClass, '--force' => true]);
            $output[] = trim(Artisan::output());
            $output[] = 'Loaded the superadmin account and the CY 2016–2026 historical mishap record.';
        } else {
            $output[] = 'Seeder skipped — records already present. Append ?seed=1 to reseed.';
        }

        Artisan::call('config:cache');
        Artisan::call('route:cache');
        $output[] = 'Config and route caches rebuilt.';

        $body = "Mishap Records setup complete.\n\n".implode("\n\n", $output)
            ."\n\nSign in, then IMPORTANT: blank SETUP_TOKEN in .env now and reload any page.\n";

        return response($body, 200, ['Content-Type' => 'text/plain; charset=utf-8']);
    }
}
