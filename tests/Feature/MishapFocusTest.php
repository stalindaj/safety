<?php

namespace Tests\Feature;

use App\Models\Mishap;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class MishapFocusTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_focus_link_opens_the_page_that_holds_the_record(): void
    {
        $this->actingAs(User::factory()->create());
        // 20 records in 2026, newest first → 15 on page 1, the 5 oldest on page 2.
        $ids = collect(range(1, 20))->map(fn ($d) => Mishap::factory()->create([
            'mishap_date' => sprintf('2026-01-%02d', $d),
        ])->id);
        $oldest = $ids->first();

        $this->get("/mishaps?year=2026&focus={$oldest}")->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Mishaps/Index')
                ->where('focus', $oldest)
                ->where('mishaps.current_page', 2)
                ->where('mishaps.data.4.id', $oldest));

        // The newest record stays on page 1.
        $this->get('/mishaps?year=2026&focus='.$ids->last())
            ->assertInertia(fn (AssertableInertia $page) => $page->where('mishaps.current_page', 1));
    }

    public function test_an_unknown_focus_just_shows_the_first_page(): void
    {
        $this->actingAs(User::factory()->create());
        Mishap::factory()->create();

        $this->get('/mishaps?focus=999')->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->where('mishaps.current_page', 1));
    }
}
