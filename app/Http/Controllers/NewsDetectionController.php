<?php

namespace App\Http\Controllers;

use App\Models\NewsDetection;
use App\Support\News\NewsWatcher;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Overruling the news watcher. It decides on its own; these let a person
 * check now, undo an automatic log, or hand an event back to the watcher.
 * "Log anyway" goes through the outside occurrence form.
 */
class NewsDetectionController extends Controller
{
    public function check(): RedirectResponse
    {
        $stats = NewsWatcher::run();

        if (isset($stats['skipped'])) {
            return back()->with('success', $stats['skipped']);
        }
        $failed = count($stats['errors']);

        return back()->with('success', "News checked: {$stats['new']} new events, {$stats['logged']} logged automatically"
            .($failed ? " ({$failed} sources could not be reached)." : '.'));
    }

    public function dismiss(Request $request, NewsDetection $newsDetection): RedirectResponse
    {
        NewsWatcher::dismiss($newsDetection, $request->user()?->id);

        return back()->with('success', 'Removed. The watcher learns from this.');
    }

    public function restore(NewsDetection $newsDetection): RedirectResponse
    {
        NewsWatcher::restore($newsDetection);

        return back()->with('success', 'Handed back to the watcher to decide.');
    }
}
