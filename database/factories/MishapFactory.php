<?php

namespace Database\Factories;

use App\Models\Mishap;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Mishap>
 */
class MishapFactory extends Factory
{
    protected $model = Mishap::class;

    public function definition(): array
    {
        return [
            'mishap_date' => $this->faker->dateTimeBetween('-8 years', 'now')->format('Y-m-d'),
            'location' => $this->faker->randomElement(['MDAAB', 'TOG 9', 'EAAB', 'Cavite City', 'LAB']),
            'mishap_type' => $this->faker->randomElement(Mishap::TYPES),
            'environment' => $this->faker->randomElement(Mishap::ENVIRONMENTS),
            'description' => $this->faker->sentence(12),
            'corrective_action' => null,
            'lesson_learned' => null,
        ];
    }
}
