<?php

use App\Http\Controllers\ModelApiController;
use Illuminate\Support\Facades\Route;

// Forecast notebook link (Google Colab or a laptop). Token-guarded and
// rate-limited; see EnsureModelApiToken and MODEL_API_TOKEN in .env.
Route::middleware(['model.token', 'throttle:30,1'])->prefix('model')->group(function () {
    Route::get('/data', [ModelApiController::class, 'data']);
    Route::post('/forecasts', [ModelApiController::class, 'forecasts']);
});
