<?php

namespace App\Providers;

use Illuminate\Database\Schema\Builder;
use Illuminate\Foundation\Console\ServeCommand;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Local dev on Windows: `php artisan serve` strips TEMP/TMP from the PHP
        // server's environment, so file uploads and large POSTs fail with
        // "Unable to create temporary file". Pass them through. (cPanel is unaffected.)
        if ($this->app->runningInConsole()) {
            ServeCommand::$passthroughVariables = [...ServeCommand::$passthroughVariables, 'TEMP', 'TMP'];
        }
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
