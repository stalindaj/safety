<?php

namespace Tests\Feature;

use App\Models\CorrectiveAction;
use App\Models\Mishap;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class CorrectiveActionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    /** @return array<string, mixed> */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'corrective_action' => 'Conduct a wing safety seminar on hazard identification.',
            'opr' => 'WSO',
            'follow_up_name' => 'SSgt Juan Dela Cruz',
            'follow_up_contact' => '0917 123 4567',
            'follow_up_email' => 'juan.delacruz@example.com',
            'status' => 'ongoing',
        ], $overrides);
    }

    private function compliedAction(): CorrectiveAction
    {
        $mishap = Mishap::factory()->create();
        $this->post("/mishaps/{$mishap->id}/plan", $this->payload([
            'status' => 'complied',
            'photos' => [UploadedFile::fake()->image('seminar.jpg')],
        ]))->assertSessionHasNoErrors();

        return CorrectiveAction::sole();
    }

    public function test_complied_is_rejected_without_a_proof_photo(): void
    {
        $this->actingAs(User::factory()->create());
        $mishap = Mishap::factory()->create();

        $this->post("/mishaps/{$mishap->id}/plan", $this->payload(['status' => 'complied']))
            ->assertSessionHasErrors('status');

        $this->assertSame(0, CorrectiveAction::count());
    }

    public function test_complied_with_a_photo_saves_the_follow_up_person_and_proof(): void
    {
        $this->actingAs(User::factory()->create());
        $action = $this->compliedAction();

        $this->assertSame('SSgt Juan Dela Cruz', $action->follow_up_name);
        $this->assertSame('0917 123 4567', $action->follow_up_contact);
        Storage::disk('local')->assertExists($action->proofs()->sole()->path);
    }

    public function test_a_pdf_counts_as_proof_and_opens_in_the_browser(): void
    {
        $this->actingAs(User::factory()->create());
        $mishap = Mishap::factory()->create();

        $this->post("/mishaps/{$mishap->id}/plan", $this->payload([
            'status' => 'complied',
            'photos' => [UploadedFile::fake()->create('signed-memo.pdf', 300, 'application/pdf')],
        ]))->assertSessionHasNoErrors();

        $proof = CorrectiveAction::sole()->proofs()->sole();
        $this->assertTrue($proof->isPdf());

        $this->get("/mishaps/{$mishap->id}/plan")->assertInertia(fn (AssertableInertia $page) => $page
            ->where('entries.0.proofs.0.kind', 'pdf')
            ->where('entries.0.proofs.0.name', 'signed-memo.pdf'));

        $this->get("/cap-proofs/{$proof->id}")->assertOk()
            ->assertHeader('Content-Type', 'application/pdf')
            ->assertHeader('X-Content-Type-Options', 'nosniff');
    }

    public function test_other_file_types_and_big_files_are_rejected(): void
    {
        $this->actingAs(User::factory()->create());
        $mishap = Mishap::factory()->create();

        $this->post("/mishaps/{$mishap->id}/plan", $this->payload([
            'photos' => [
                UploadedFile::fake()->create('notes.docx', 50, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
                UploadedFile::fake()->create('scan.pdf', 6000, 'application/pdf'),
            ],
        ]))->assertSessionHasErrors(['photos.0', 'photos.1']);

        $this->assertSame(0, CorrectiveAction::count());
    }

    public function test_an_action_takes_at_most_three_photos(): void
    {
        $this->actingAs(User::factory()->create());
        $mishap = Mishap::factory()->create();
        $photos = array_map(fn ($i) => UploadedFile::fake()->image("p{$i}.jpg"), range(1, 4));

        $this->post("/mishaps/{$mishap->id}/plan", $this->payload(['photos' => $photos]))
            ->assertSessionHasErrors('photos');
    }

    public function test_the_last_photo_of_a_complied_action_cannot_be_removed(): void
    {
        $this->actingAs(User::factory()->create());
        $action = $this->compliedAction();
        $proof = $action->proofs()->sole();

        $this->post("/corrective-actions/{$action->id}", $this->payload([
            '_method' => 'put',
            'status' => 'complied',
            'remove_photos' => [$proof->id],
        ]))->assertSessionHasErrors('status');

        Storage::disk('local')->assertExists($proof->path);
    }

    public function test_proof_photos_are_only_served_to_signed_in_users(): void
    {
        $this->actingAs(User::factory()->create());
        $proof = $this->compliedAction()->proofs()->sole();

        $this->get("/cap-proofs/{$proof->id}")->assertOk();

        auth()->logout();
        $this->get("/cap-proofs/{$proof->id}")->assertRedirect('/login');
    }

    public function test_the_plan_page_shows_the_follow_up_person_and_proof(): void
    {
        $this->actingAs(User::factory()->create());
        $action = $this->compliedAction();

        $this->get("/mishaps/{$action->mishap_id}/plan")
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Mishaps/Plan')
                ->where('entries.0.follow_up_name', 'SSgt Juan Dela Cruz')
                ->has('entries.0.proofs', 1)
                ->where('max_proofs', CorrectiveAction::MAX_PROOFS));
    }

    public function test_the_dashboard_lists_each_mishap_with_its_caps_by_unit(): void
    {
        $this->actingAs(User::factory()->create());
        $action = $this->compliedAction();

        $this->get('/')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Dashboard')
                ->where('caps.0.id', $action->mishap_id)
                ->where('caps.0.actions.0.unit', 'WSO')
                ->where('caps.0.actions.0.status', 'complied')
                ->where('caps.0.actions.0.follow_up', 'SSgt Juan Dela Cruz')
                ->where('caps.0.actions.0.proof', true));
    }

    public function test_deleting_the_mishap_removes_its_proof_photos(): void
    {
        $this->actingAs(User::factory()->create());
        $action = $this->compliedAction();
        $path = $action->proofs()->sole()->path;

        $this->delete("/mishaps/{$action->mishap_id}")->assertSessionHasNoErrors();

        Storage::disk('local')->assertMissing($path);
        $this->assertSame(0, CorrectiveAction::count());
    }
}
