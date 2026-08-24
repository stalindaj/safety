<?php

namespace App\Providers;

use Illuminate\Database\Schema\Builder;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // utf8mb4 + older MySQL index limits: keep every string index under 767 bytes.
        Builder::defaultStringLength(191);

        // Shared hosting terminates TLS in front of PHP, so Laravel can generate
        // http:// URLs on an https:// page unless we force the scheme.
        if (env('FORCE_HTTPS', false)) {
            URL::forceScheme('https');
        }
    }
}
