<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    public function edit(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('Account/Edit', [
            'account' => [
                'name' => $user->name,
                'rank' => $user->rank,
                'email' => $user->email,
                'role' => $user->role,
            ],
        ]);
    }

    public function updatePassword(Request $request): RedirectResponse
    {
        $request->validate([
            'current_password' => ['required', 'current_password'],
            'password' => ['required', 'confirmed', Password::min(8)],
        ]);

        // The User model casts `password` as "hashed", so assigning the plain
        // value hashes it on save.
        $request->user()->update(['password' => $request->password]);

        return back()->with('success', 'Password updated.');
    }
}
