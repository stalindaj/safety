<?php

namespace App\Http\Controllers;

use App\Models\CorrectiveAction;
use App\Models\CorrectiveActionProof;
use App\Models\Mishap;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CorrectiveActionController extends Controller
{
    public function show(Mishap $mishap): Response
    {
        $mishap->load('correctiveActions.proofs');

        return Inertia::render('Mishaps/Plan', [
            'mishap' => [
                'id' => $mishap->id,
                'display_date' => $mishap->mishap_date->format('d M Y'),
                'location' => $mishap->location,
                'mishap_type' => $mishap->mishap_type,
                'environment' => $mishap->environment,
                'category' => $mishap->category,
                'description' => $mishap->description,
            ],
            'entries' => $mishap->correctiveActions->map(fn (CorrectiveAction $c) => $this->present($c)),
            'statuses' => CorrectiveAction::STATUSES,
            'max_proofs' => CorrectiveAction::MAX_PROOFS,
        ]);
    }

    public function store(Request $request, Mishap $mishap): RedirectResponse
    {
        $data = $this->validated($request);

        DB::transaction(function () use ($request, $mishap, $data) {
            $action = $mishap->correctiveActions()->create(
                $data + ['sort_order' => (int) $mishap->correctiveActions()->max('sort_order') + 1],
            );
            $this->storePhotos($request, $action);
        });

        return back()->with('success', 'Corrective action added.');
    }

    public function update(Request $request, CorrectiveAction $correctiveAction): RedirectResponse
    {
        $data = $this->validated($request, $correctiveAction);

        DB::transaction(function () use ($request, $correctiveAction, $data) {
            $correctiveAction->update($data);
            $correctiveAction->proofs()->whereIn('id', $this->removedPhotoIds($request))->get()->each->delete();
            $this->storePhotos($request, $correctiveAction);
        });

        return back()->with('success', 'Corrective action updated.');
    }

    public function destroy(CorrectiveAction $correctiveAction): RedirectResponse
    {
        $correctiveAction->delete();

        return back()->with('success', 'Corrective action removed.');
    }

    /** Proof photos sit outside public/, so they're streamed to signed-in users only. */
    public function photo(CorrectiveActionProof $proof): StreamedResponse
    {
        $disk = Storage::disk(CorrectiveActionProof::DISK);
        abort_unless($disk->exists($proof->path), 404);

        return $disk->response($proof->path, $proof->original_name, ['Cache-Control' => 'private, max-age=86400']);
    }

    /** @return array<string, mixed> */
    private function validated(Request $request, ?CorrectiveAction $action = null): array
    {
        $data = $request->validate([
            'latent_condition' => ['nullable', 'string'],
            'category' => ['nullable', 'string', 'max:190'],
            'cause_factor' => ['nullable', 'string', 'max:190'],
            'opr' => ['nullable', 'string', 'max:190'],
            'follow_up_name' => ['nullable', 'string', 'max:190'],
            'follow_up_contact' => ['nullable', 'string', 'max:40', 'regex:/^[0-9+()\-.\s]+$/'],
            'follow_up_email' => ['nullable', 'email', 'max:190'],
            'corrective_action' => ['required', 'string'],
            'staff_action' => ['nullable', 'string'],
            'intervention' => ['nullable', 'string'],
            'photos' => ['nullable', 'array', 'max:'.CorrectiveAction::MAX_PROOFS],
            'photos.*' => ['image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'remove_photos' => ['nullable', 'array'],
            'remove_photos.*' => ['integer'],
            'status' => ['required', Rule::in(CorrectiveAction::STATUSES)],
            'remarks' => ['nullable', 'string'],
        ], [
            'follow_up_contact.regex' => 'Use digits only, e.g. 0917 123 4567.',
            'photos.max' => 'Attach up to '.CorrectiveAction::MAX_PROOFS.' proof photos.',
            'photos.*.image' => 'Proof must be a photo (JPG, PNG or WebP).',
            'photos.*.mimes' => 'Proof must be a photo (JPG, PNG or WebP).',
            'photos.*.max' => 'Each photo must be 5 MB or smaller.',
        ]);

        // Photos that will be on file once this save goes through.
        $kept = $action ? $action->proofs()->whereNotIn('id', $this->removedPhotoIds($request))->count() : 0;
        $total = $kept + count($request->file('photos', []));

        if ($total > CorrectiveAction::MAX_PROOFS) {
            throw ValidationException::withMessages([
                'photos' => 'Attach up to '.CorrectiveAction::MAX_PROOFS.' proof photos.',
            ]);
        }

        // No proof, no compliance.
        if ($data['status'] === CorrectiveAction::COMPLIED && $total === 0) {
            throw ValidationException::withMessages([
                'status' => 'Attach at least one proof photo before marking this action Complied.',
            ]);
        }

        return Arr::except($data, ['photos', 'remove_photos']);
    }

    /** @return list<int> */
    private function removedPhotoIds(Request $request): array
    {
        return array_map('intval', (array) $request->input('remove_photos', []));
    }

    private function storePhotos(Request $request, CorrectiveAction $action): void
    {
        foreach ($request->file('photos', []) as $file) {
            $action->proofs()->create([
                'path' => $file->store($action->proofDirectory(), CorrectiveActionProof::DISK),
                'original_name' => $file->getClientOriginalName(),
                'size' => $file->getSize(),
            ]);
        }
    }

    /** @return array<string, mixed> */
    private function present(CorrectiveAction $c): array
    {
        return [
            'id' => $c->id,
            'latent_condition' => $c->latent_condition,
            'category' => $c->category,
            'cause_factor' => $c->cause_factor,
            'opr' => $c->opr,
            'follow_up_name' => $c->follow_up_name,
            'follow_up_contact' => $c->follow_up_contact,
            'follow_up_email' => $c->follow_up_email,
            'corrective_action' => $c->corrective_action,
            'staff_action' => $c->staff_action,
            'intervention' => $c->intervention,
            'proofs' => $c->proofs->map(fn (CorrectiveActionProof $p) => [
                'id' => $p->id,
                'url' => route('cap-proofs.show', $p, false),
                'name' => $p->original_name,
            ])->values(),
            'status' => $c->status,
            'remarks' => $c->remarks,
        ];
    }
}
