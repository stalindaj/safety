<?php

use App\Http\Controllers\Auth\SessionController;
use App\Http\Controllers\CorrectiveActionController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\MishapController;
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

    // Account — change your own password.
    Route::get('/account', [ProfileController::class, 'edit'])->name('account.edit');
    Route::put('/account/password', [ProfileController::class, 'updatePassword'])->name('account.password');
});

// One-time browser installer — there is no SSH/terminal on the production host.
Route::get('/setup/{token}', SetupController::class)->name('setup');
