<?php

namespace Tests;

use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /** Sign in as a training branch account and return it. */
    protected function actingAsStaff(array $attributes = []): User
    {
        $user = User::factory()->create($attributes + ['rank' => 'A2C', 'role' => 'admin']);

        $this->actingAs($user);

        return $user;
    }
}
