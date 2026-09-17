<?php

use App\Support\News\NewsWatcher;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// News watcher: search the news for flying-related occurrences.
Artisan::command('safety:watch-news', function () {
    $stats = NewsWatcher::run();
    if (isset($stats['skipped'])) {
        $this->warn($stats['skipped']);

        return;
    }
    $this->info("Checked {$stats['articles']} articles from the last {$stats['days']} days "
        ."({$stats['untrusted']} from untrusted outlets skipped): {$stats['relevant']} about flying safety, "
        ."{$stats['new']} new events, {$stats['grouped']} added to known events, {$stats['logged']} logged automatically.");
    foreach ($stats['errors'] as $error) {
        $this->warn("Search failed: {$error}");
    }
})->purpose('Check the news for flying-related occurrences (the news watcher)');

// cPanel → Cron Jobs runs "php artisan schedule:run" every minute (or run the
// command above hourly directly). Hourly keeps us polite to Google News.
Schedule::command('safety:watch-news')->hourly()->withoutOverlapping();
