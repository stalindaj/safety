<?php

namespace Tests;

use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Http;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Tests never reach real outside services (e.g. live airfield weather);
        // a test that needs one fakes it explicitly.
        Http::preventStrayRequests();
    }

    /** Sign in as a training branch account and return it. */
    protected function actingAsStaff(array $attributes = []): User
    {
        $user = User::factory()->create($attributes + ['rank' => 'A2C', 'role' => 'admin']);

        $this->actingAs($user);

        return $user;
    }
}
