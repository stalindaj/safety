<?php

use App\Http\Controllers\Auth\SessionController;
use App\Http\Controllers\CapsController;
use App\Http\Controllers\CorrectiveActionController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ExternalOccurrenceController;
use App\Http\Controllers\ForecastController;
use App\Http\Controllers\MishapController;
use App\Http\Controllers\NewsDetectionController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\SetupController;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function () {
    Route::get('/login', [SessionController::class, 'create'])->name('login');
    Route::post('/login', [SessionController::class, 'store'])->name('login.store');
});

Route::post('/logout', [SessionController::class, 'destroy'])
    ->middleware('auth')
    ->name('logout');

Route::middleware('auth')->group(function () {
    Route::get('/', DashboardController::class)->name('dashboard');

    // CAPS follow-through — every mishap's corrective actions, by year and by unit.
    Route::get('/caps', CapsController::class)->name('caps');

    // Safety Forecast — weekly base rate (notebook) + Predictive Safety Forecast.
    Route::get('/forecast', ForecastController::class)->name('forecast');

    // Mishap Records — intake, edit, and removal.
    Route::get('/mishaps', [MishapController::class, 'index'])->name('mishaps.index');
    Route::post('/mishaps', [MishapController::class, 'store'])->name('mishaps.store');
    Route::put('/mishaps/{mishap}', [MishapController::class, 'update'])->name('mishaps.update');
    Route::delete('/mishaps/{mishap}', [MishapController::class, 'destroy'])->name('mishaps.destroy');

    // Corrective Action Plan (per mishap) — the detailed, tracked view.
    Route::get('/mishaps/{mishap}/plan', [CorrectiveActionController::class, 'show'])->name('mishaps.plan');
    Route::post('/mishaps/{mishap}/plan', [CorrectiveActionController::class, 'store'])->name('mishaps.plan.store');
    Route::put('/corrective-actions/{correctiveAction}', [CorrectiveActionController::class, 'update'])->name('corrective-actions.update');
    Route::delete('/corrective-actions/{correctiveAction}', [CorrectiveActionController::class, 'destroy'])->name('corrective-actions.destroy');
    Route::get('/cap-proofs/{proof}', [CorrectiveActionController::class, 'photo'])->name('cap-proofs.show');

    // Early warning — occurrences outside the Wing, logged as advisories.
    Route::post('/external-occurrences', [ExternalOccurrenceController::class, 'store'])->name('external-occurrences.store');
    Route::put('/external-occurrences/{externalOccurrence}', [ExternalOccurrenceController::class, 'update'])->name('external-occurrences.update');
    Route::delete('/external-occurrences/{externalOccurrence}', [ExternalOccurrenceController::class, 'destroy'])->name('external-occurrences.destroy');

    // News watcher — check now, and dismiss / restore detections (confirm goes through the form above).
    Route::post('/news-watch/check', [NewsDetectionController::class, 'check'])->middleware('throttle:6,1')->name('news-watch.check');
    Route::post('/news-detections/{newsDetection}/dismiss', [NewsDetectionController::class, 'dismiss'])->name('news-detections.dismiss');
    Route::post('/news-detections/{newsDetection}/restore', [NewsDetectionController::class, 'restore'])->name('news-detections.restore');

    // Account — change your own password.
    Route::get('/account', [ProfileController::class, 'edit'])->name('account.edit');
    Route::put('/account/password', [ProfileController::class, 'updatePassword'])->name('account.password');
});

// One-time browser installer — there is no SSH/terminal on the production host.
Route::get('/setup/{token}', SetupController::class)->name('setup');
