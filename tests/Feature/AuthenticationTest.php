<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_are_redirected_to_the_login_screen(): void
    {
        $this->get('/')->assertRedirect('/login');
    }

    public function test_login_screen_renders(): void
    {
        $this->get('/login')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->component('Auth/Login'));
    }

    public function test_a_user_can_sign_in_with_valid_credentials(): void
    {
        $user = User::factory()->create([
            'email' => 'training@15sw.paf.mil.ph',
            'password' => Hash::make('secret-password'),
        ]);

        $this->post('/login', [
            'email' => 'training@15sw.paf.mil.ph',
            'password' => 'secret-password',
        ])->assertRedirect('/');

        $this->assertAuthenticatedAs($user);
    }

    public function test_bad_credentials_are_rejected(): void
    {
        User::factory()->create(['email' => 'training@15sw.paf.mil.ph']);

        $this->post('/login', [
            'email' => 'training@15sw.paf.mil.ph',
            'password' => 'wrong',
        ])->assertSessionHasErrors('email');

        $this->assertGuest();
    }

    public function test_email_and_password_are_required(): void
    {
        $this->post('/login', [])->assertSessionHasErrors(['email', 'password']);
    }

    public function test_a_signed_in_user_can_sign_out(): void
    {
        $this->actingAsStaff();

        $this->post('/logout')->assertRedirect('/login');

        $this->assertGuest();
    }

    public function test_signed_in_users_do_not_see_the_login_screen(): void
    {
        $this->actingAsStaff();

        $this->get('/login')->assertRedirect('/');
    }
}
