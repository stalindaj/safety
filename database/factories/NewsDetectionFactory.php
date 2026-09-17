<?php

namespace Database\Factories;

use App\Models\NewsDetection;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<NewsDetection> */
class NewsDetectionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'occurred_on' => now('Asia/Manila')->subDays($this->faker->numberBetween(0, 20))->toDateString(),
            'headline' => 'Plane makes emergency landing in '.$this->faker->randomElement(['Davao', 'Cebu', 'Clark']),
            'kind' => 'incident',
            'region' => 'luzon',
            'place' => null,
            'aircraft' => null,
            'fleet_type' => null,
            'military' => false,
            'category' => 'Hard / precautionary landing',
            'why' => ['In the Philippines'],
            'score' => 1,
            'trust' => null,
            'status' => NewsDetection::INFO,
            'auto' => true,
        ];
    }
}
