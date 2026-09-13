<?php

namespace App\Http\Controllers;

use App\Models\ExternalOccurrence;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

/** Log / edit / remove occurrences outside the Wing (early-warning advisories). */
class ExternalOccurrenceController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        ExternalOccurrence::create($this->validated($request) + ['created_by' => $request->user()?->id]);

        return back()->with('success', 'Outside occurrence logged.');
    }

    public function update(Request $request, ExternalOccurrence $externalOccurrence): RedirectResponse
    {
        $externalOccurrence->update($this->validated($request));

        return back()->with('success', 'Outside occurrence updated.');
    }

    public function destroy(ExternalOccurrence $externalOccurrence): RedirectResponse
    {
        $externalOccurrence->delete();

        return back()->with('success', 'Outside occurrence removed.');
    }

    /** @return array<string, mixed> */
    private function validated(Request $request): array
    {
        $data = $request->validate([
            'occurred_on' => ['required', 'date', 'before_or_equal:today'],
            'region' => ['required', Rule::in(array_keys(ExternalOccurrence::REGIONS))],
            'location' => ['required', 'string', 'max:190'],
            'aircraft' => ['nullable', 'string', 'max:190'],
            'category' => ['required', Rule::in(ExternalOccurrence::categories())],
            'summary' => ['required', 'string', 'max:2000'],
            'source_url' => ['nullable', 'url', 'max:500'],
            'brief_until' => ['nullable', 'date', 'after_or_equal:occurred_on'],
        ], [
            'occurred_on.before_or_equal' => 'The date can\'t be in the future.',
            'brief_until.after_or_equal' => 'Brief-until must be on or after the date it happened.',
        ]);

        $data['brief_until'] ??= Carbon::parse($data['occurred_on'])
            ->addDays(ExternalOccurrence::DEFAULT_BRIEF_DAYS)->toDateString();

        return $data;
    }
}
