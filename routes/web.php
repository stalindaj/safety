<?php

use App\Http\Controllers\Auth\SessionController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\MishapController;
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
});

// One-time browser installer — there is no SSH/terminal on the production host.
Route::get('/setup/{token}', SetupController::class)->name('setup');
