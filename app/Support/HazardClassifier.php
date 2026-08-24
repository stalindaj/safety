<?php

namespace App\Support;

/**
 * Derives a single plain-language "cause" for a mishap from its free-text
 * description. The historical workbook never captured a cause field, so we infer
 * it with keyword matching — good enough to surface the dominant hazards for
 * non-analyst readers, and it keeps working as staff add new records.
 *
 * Categories are checked in priority order (specific/aviation causes before
 * generic ones) and the first match wins, so every mishap lands in exactly one
 * bucket and the percentages add up to 100.
 */
class HazardClassifier
{
    /**
     * Ordered map of category label => keyword fragments (matched lowercased,
     * as substrings). Order matters: the first category with a hit wins.
     *
     * @var array<string, list<string>>
     */
    private const RULES = [
        'Bird / wildlife strike' => ['bird', 'batstrike', 'bat strike', ' bat ', 'goat', 'stray animal', 'dog', 'carabao'],
        'Kite / wire strike' => ['kite', 'wire strike', 'cellophane', 'plastic', 'balloon'],
        'Weapon / armament' => ['machine gun', 'cook-off', 'caliber', '.50', 'ammunition', 'bomb', 'flash-hider', 'hmp', 'gun ', 'live-fire', 'rocket', 'bullet'],
        'Engine / powerplant' => ['engine', 'powerplant', 'oil leak', 'flame', 'flamed out', 'shutdown', 'shut down', 'loss of power', 'single engine', 'power management'],
        'Landing gear / tire / brake' => ['tire', 'landing gear', 'nose wheel', 'wheel', 'brake', 'skid', 'blown tire', 'flat '],
        'Canopy / door detachment' => ['canopy', 'door assemblies', 'observer canopy', 'detach', 'door '],
        'Hard / precautionary landing' => ['hard landing', 'precautionary', 'emergency landing', 'diversion', 'smash down', 'crash'],
        'Fire' => ['fire broke', 'caught fire', 'butane', 'explosion', 'fire emergency', 'faulty electrical'],
        'Vehicle / road collision' => ['motorcycle', 'vehicle', 'truck', ' car ', 'bumped', 'collided', 'collision', 'sideswipe', 'side-swept', 'sideswiped', 'rear end', 'tricycle', ' bus ', 'traffic', 'bumper', 'sidecar', 'coaster', 'run over', 'road run'],
        'Fall / personnel injury' => ['fell', ' fall', 'slipped', 'lost control', 'injur', 'abrasion', 'contusion', 'bruise', 'fractured', 'unconscious'],
    ];

    public const OTHER = 'Other / mechanical';

    /**
     * The canonical cause list for the intake dropdown and validation, ordered
     * roughly by how often it shows up in the record. Must stay in sync with the
     * RULES keys above (plus OTHER) — every value primary() can return is here.
     *
     * @var list<string>
     */
    public const CATEGORIES = [
        'Vehicle / road collision',
        'Bird / wildlife strike',
        'Engine / powerplant',
        'Landing gear / tire / brake',
        'Canopy / door detachment',
        'Weapon / armament',
        'Kite / wire strike',
        'Hard / precautionary landing',
        'Fall / personnel injury',
        'Fire',
        self::OTHER,
    ];

    /** The single most likely cause for one description. */
    public static function primary(?string $description): string
    {
        $text = ' '.mb_strtolower((string) $description).' ';

        foreach (self::RULES as $label => $keywords) {
            foreach ($keywords as $keyword) {
                if (str_contains($text, $keyword)) {
                    return $label;
                }
            }
        }

        return self::OTHER;
    }

    /**
     * Count descriptions per category, biggest first, keeping the ordering
     * stable. Returns [label => count] with only non-empty categories.
     *
     * @param  iterable<string|null>  $descriptions
     * @return array<string, int>
     */
    public static function tally(iterable $descriptions): array
    {
        $counts = [];

        foreach ($descriptions as $description) {
            $label = self::primary($description);
            $counts[$label] = ($counts[$label] ?? 0) + 1;
        }

        arsort($counts);

        return $counts;
    }
}
