<?php

namespace App\Support;

/**
 * Best-effort extraction of taxonomy attributes (aircraft, flight phase, vehicle
 * type, rank group) from a mishap's free-text description. Used to backfill the
 * historical record so the deeper analysis has data to work with; new records
 * capture these on the intake form. Keyword-based, first match wins — good
 * enough to surface the dominant patterns for non-analyst readers.
 */
class MishapAttributes
{
    /** Canonical label => keyword fragments (lowercased substring match). */
    private const AIRCRAFT = [
        'OV-10' => ['ov-10', 'ov10'],
        'A-29B ST' => ['a-29b', 'a29b', 'super tucano', 'tucano'],
        'SF-260TP' => ['sf-260', 'sf260'],
        'T-129 ATAK' => ['t-129', 't129', 'atak'],
        'AW-109' => ['aw-109', 'aw109', 'aw 109', 'aw-109ah'],
        'MD-520MG' => ['md-520', 'md520', 'md 520'],
        'MD-500ER' => ['md-500', 'md500', 'md 500'],
    ];

    private const PHASE = [
        'Landing' => ['landing', 'approach', 'touch and go', 'touch-and-go', 'touchdown', 'landing roll', 'final approach'],
        'Take-off' => ['take-off', 'takeoff', 'take off', 'departure', 'lift-off', 'initial climb', 'climb-out'],
        'Cruise' => ['cruise', 'en route', 'enroute', 'transit', 'in-flight', 'in flight', 'orbit'],
        'Ground' => ['ground run', 'towed', 'being towed', 'parked', 'hangar', 'post-flight', 'pre-flight',
            'post flight', 'pre flight', 'de-arming', 'dearming', 'taxi', 'taxiing', 'functional check',
            'pintle', 'certification', 'maintenance', 'inspection', 'troubleshooting'],
    ];

    private const VEHICLE = [
        'PATMV' => ['m-35', 'm35', 'jbc', 'military vehicle', 'km-450', 'km450', 'deuce', '6x6', 'prime mover'],
        'POV 2-wheel' => ['motorcycle', 'tricycle', 'bicycle', 'scooter', 'big bike', 'e-bike', 'ebike', 'motorbike'],
        'POV 4-wheel' => ['innova', 'mazda', 'wagon', 'tamaraw', ' fx', 'sedan', 'pick-up', 'pickup', 'coaster',
            ' van', 'suv', 'toyota', 'mitsubishi', 'jeep', ' bus', ' car ', 'vehicle', ' truck'],
    ];

    // Order matters: NCO (SSgt-CMS) is checked before EP so "staff sergeant"
    // etc. don't fall into EP's generic "sergeant"/"sgt".
    private const RANK = [
        'Civilian' => ['civilian', ' civ ', 'civ personnel'],
        'NCO' => ['staff sergeant', 'technical sergeant', 'master sergeant', 'senior master', 'chief master',
            'ssgt', ' ssg', 'tsgt', 'msgt', ' cms', 'non-commissioned'],
        'EP' => ['airman', ' amn', ' am ', 'a1c', 'a2c', 'enlisted', ' ep ', 'sergeant', ' sgt'],
        'Officer' => ['officer', 'lieutenant', ' lt ', 'captain', ' capt', 'major', 'colonel', 'general', 'pilot'],
    ];

    public static function aircraft(?string $d): ?string
    {
        return self::firstMatch($d, self::AIRCRAFT);
    }

    public static function phase(?string $d): ?string
    {
        return self::firstMatch($d, self::PHASE);
    }

    public static function vehicleType(?string $d): ?string
    {
        return self::firstMatch($d, self::VEHICLE);
    }

    public static function rankGroup(?string $d): ?string
    {
        return self::firstMatch($d, self::RANK);
    }

    /** @param array<string, list<string>> $rules */
    private static function firstMatch(?string $description, array $rules): ?string
    {
        $text = ' '.mb_strtolower((string) $description).' ';
        foreach ($rules as $label => $keywords) {
            foreach ($keywords as $keyword) {
                if (str_contains($text, $keyword)) {
                    return $label;
                }
            }
        }

        return null;
    }
}
