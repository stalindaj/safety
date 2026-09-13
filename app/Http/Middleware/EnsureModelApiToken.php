<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Guards the notebook link (/api/model/*) with MODEL_API_TOKEN. A blank token
 * switches the link off entirely. The token is accepted as a Bearer header or
 * X-Model-Token, because some shared hosts strip Authorization before PHP.
 */
class EnsureModelApiToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $expected = (string) config('services.model_api.token');
        abort_if($expected === '', 404);

        $given = (string) ($request->bearerToken() ?: $request->header('X-Model-Token'));
        abort_unless(hash_equals($expected, $given), 401, 'Invalid model token.');

        return $next($request);
    }
}
