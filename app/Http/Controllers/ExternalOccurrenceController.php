<?php

namespace App\Http\Controllers;

use App\Models\ExternalOccurrence;
use App\Models\NewsDetection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

/** Log / edit / remove occurrences outside the Wing (early-warning advisories). */
class ExternalOccurrenceController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $occurrence = ExternalOccurrence::create($this->validated($request) + ['created_by' => $request->user()?->id]);

        // "Log anyway" from the news watcher: a person's decision, which the model learns from.
        $detection = $request->integer('news_detection_id') ? NewsDetection::find($request->integer('news_detection_id')) : null;
        $detection?->update(['status' => NewsDetection::CONFIRMED, 'auto' => false, 'external_occurrence_id' => $occurrence->id,
            'reviewed_by' => $request->user()?->id, 'reviewed_at' => now()]);

        return back()->with('success', $detection ? 'Logged from the news as an outside occurrence.' : 'Outside occurrence logged.');
    }

    public function update(Request $request, ExternalOccurrence $externalOccurrence): RedirectResponse
    {
        $externalOccurrence->update($this->validated($request));

        return back()->with('success', 'Outside occurrence updated.');
    }

    public function destroy(Request $request, ExternalOccurrence $externalOccurrence): RedirectResponse
    {
        // Removing one the watcher logged from the news tells the model it shouldn't have been.
        if ($detection = $externalOccurrence->newsDetection) {
            $detection->update(['status' => NewsDetection::DISMISSED, 'auto' => false, 'external_occurrence_id' => null,
                'reviewed_by' => $request->user()?->id, 'reviewed_at' => now()]);
        }
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
