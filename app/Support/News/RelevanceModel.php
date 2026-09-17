<?php

namespace App\Support\News;

use App\Models\NewsDetection;
use Illuminate\Support\Collection;

/**
 * Learns what the Safety Office finds worth logging from the times a person
 * overruled the watcher (Undo an automatic log, or Log anyway): a naive Bayes
 * text classifier over the headline words plus the watcher's findings (region,
 * kind, our aircraft type, military, category). Small, fast, and explainable:
 * it can say which words pushed a headline up or down.
 *
 * It never logs or removes anything by itself. Once it has enough examples it
 * can only hand an event to a person: an automatic log it doubts, or an
 * information item it thinks the office would log. Off until then.
 */
class RelevanceModel
{
    /** Examples of each answer needed before the model is used. */
    public const MIN_EACH = 5;

    /** Examples of each answer needed before its accuracy is measured. */
    public const MIN_FOR_ACCURACY = 10;

    /** @var array<int, int> answer (1 = confirmed, 0 = dismissed) => examples */
    private array $docs = [0 => 0, 1 => 0];

    /** @var array<int, array<string, int>> answer => feature => examples that have it */
    private array $counts = [0 => [], 1 => []];

    /** @var list<array{0: list<string>, 1: int}> */
    private array $examples = [];

    public static function fromDatabase(): self
    {
        // Only decisions a person made: learning from the watcher's own automatic
        // decisions would just teach the model to repeat the rules.
        return self::train(NewsDetection::query()
            ->where('auto', false)
            ->whereIn('status', [NewsDetection::CONFIRMED, NewsDetection::DISMISSED])
            ->get());
    }

    /** @param  Collection<int, NewsDetection>  $labelled */
    public static function train(Collection $labelled): self
    {
        $model = new self;
        foreach ($labelled as $d) {
            $model->add(self::features($d), $d->status === NewsDetection::CONFIRMED ? 1 : 0);
        }

        return $model;
    }

    /**
     * Headline words and the watcher's findings, as one feature set.
     *
     * @return list<string>
     */
    public static function features(NewsDetection $d): array
    {
        // The detection's headline only: a big story with 20 articles would
        // otherwise pile up words and look falsely certain.
        return array_values(array_unique([
            ...NewsReader::tokens($d->headline),
            '#kind:'.$d->kind,
            '#region:'.($d->region ?? 'unknown'),
            '#category:'.$d->category,
            '#fleet:'.($d->fleet_type ? 'yes' : 'no'),
            '#military:'.($d->military ? 'yes' : 'no'),
        ]));
    }

    public function ready(): bool
    {
        return $this->docs[0] >= self::MIN_EACH && $this->docs[1] >= self::MIN_EACH;
    }

    /** @return array{confirmed: int, dismissed: int} */
    public function examples(): array
    {
        return ['confirmed' => $this->docs[1], 'dismissed' => $this->docs[0]];
    }

    /**
     * Chance (0–1) that the office would confirm something with these
     * features, or null while there are too few examples.
     *
     * @param  list<string>  $features
     */
    public function probability(array $features): ?float
    {
        return $this->ready() ? $this->score($features, $this->docs, $this->counts) : null;
    }

    /**
     * The features that pushed this item most toward "confirm" and "dismiss".
     *
     * @param  list<string>  $features
     * @return array{up: list<string>, down: list<string>}
     */
    public function reasons(array $features, int $top = 3): array
    {
        if (! $this->ready()) {
            return ['up' => [], 'down' => []];
        }
        $weights = [];
        foreach ($features as $f) {
            if (! isset($this->counts[0][$f]) && ! isset($this->counts[1][$f])) {
                continue;          // never seen: says nothing
            }
            $weights[$f] = log($this->likelihood($f, 1, $this->docs, $this->counts))
                - log($this->likelihood($f, 0, $this->docs, $this->counts));
        }
        arsort($weights);
        $label = fn ($f) => str_starts_with($f, '#') ? str_replace(['#', ':'], ['', ': '], $f) : $f;

        return [
            'up' => array_map($label, array_keys(array_slice(array_filter($weights, fn ($w) => $w > 0.4), 0, $top, true))),
            'down' => array_map($label, array_keys(array_slice(array_reverse(array_filter($weights, fn ($w) => $w < -0.4), true), 0, $top, true))),
        ];
    }

    /**
     * Leave-one-out accuracy: each past answer is predicted by a model trained
     * on all the others. Null until there are enough examples of both answers.
     */
    public function accuracy(): ?float
    {
        if ($this->docs[0] < self::MIN_FOR_ACCURACY || $this->docs[1] < self::MIN_FOR_ACCURACY) {
            return null;
        }
        $right = 0;
        foreach ($this->examples as [$features, $label]) {
            $docs = $this->docs;
            $counts = $this->counts;
            $docs[$label]--;
            foreach ($features as $f) {
                $counts[$label][$f]--;
            }
            $right += (int) (($this->score($features, $docs, $counts) >= 0.5) === ($label === 1));
        }

        return $right / count($this->examples);
    }

    /** @param  list<string>  $features */
    private function add(array $features, int $label): void
    {
        $this->docs[$label]++;
        foreach ($features as $f) {
            $this->counts[$label][$f] = ($this->counts[$label][$f] ?? 0) + 1;
        }
        $this->examples[] = [$features, $label];
    }

    /**
     * Bernoulli-style naive Bayes over the features present, in log space.
     *
     * @param  list<string>  $features
     * @param  array<int, int>  $docs
     * @param  array<int, array<string, int>>  $counts
     */
    private function score(array $features, array $docs, array $counts): float
    {
        $total = $docs[0] + $docs[1];
        $log = [];
        foreach ([0, 1] as $c) {
            $log[$c] = log(($docs[$c] + 1) / ($total + 2));
            foreach ($features as $f) {
                $log[$c] += log($this->likelihood($f, $c, $docs, $counts));
            }
        }

        return 1 / (1 + exp($log[0] - $log[1]));
    }

    /**
     * @param  array<int, int>  $docs
     * @param  array<int, array<string, int>>  $counts
     */
    private function likelihood(string $feature, int $c, array $docs, array $counts): float
    {
        return (($counts[$c][$feature] ?? 0) + 1) / ($docs[$c] + 2);   // Laplace smoothing
    }
}
