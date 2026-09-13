<?php

namespace Tests\Feature;

use App\Models\Mishap;
use App\Models\SafetyForecast;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ModelApiTest extends TestCase
{
    use RefreshDatabase;

    private const TOKEN = 'test-model-token';

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.model_api.token' => self::TOKEN]);
    }

    /** @return array<string, mixed> */
    private function week(string $start, int $pct = 12): array
    {
        return [
            'week_start' => $start,
            'risk_level' => 'baseline',
            'likelihood' => $pct,
            'baseline' => $pct,
            'headline' => "Historically about {$pct}% of weeks have a flight mishap.",
            'reasons' => [['text' => 'Bird migration - southbound peak', 'tone' => 'alert', 'impact' => 100]],
        ];
    }

    public function test_the_link_is_off_when_no_token_is_configured(): void
    {
        config(['services.model_api.token' => '']);

        $this->getJson('/api/model/data')->assertNotFound();
    }

    public function test_a_wrong_token_is_rejected(): void
    {
        $this->withToken('wrong')->getJson('/api/model/data')->assertUnauthorized();
    }

    public function test_data_sends_model_fields_but_no_descriptions(): void
    {
        Mishap::factory()->create(['description' => 'Pilot of tail 1905 reported ...']);

        $this->withToken(self::TOKEN)->getJson('/api/model/data')
            ->assertOk()
            ->assertJsonCount(1, 'mishaps')
            ->assertJsonStructure(['mishaps' => [['mishap_date', 'environment', 'mishap_type']], 'sorties'])
            ->assertJsonMissingPath('mishaps.0.description');
    }

    public function test_the_token_also_works_as_an_x_model_token_header(): void
    {
        $this->getJson('/api/model/data', ['X-Model-Token' => self::TOKEN])->assertOk();
    }

    public function test_forecasts_replace_the_same_week_instead_of_piling_up(): void
    {
        $this->withToken(self::TOKEN)
            ->postJson('/api/model/forecasts', ['forecasts' => [$this->week('2026-09-07', 12)]])
            ->assertOk()->assertJson(['saved' => 1]);

        $this->withToken(self::TOKEN)
            ->postJson('/api/model/forecasts', ['source' => 'model v0', 'forecasts' => [$this->week('2026-09-07', 14)]])
            ->assertOk();

        $row = SafetyForecast::sole();
        $this->assertSame(14, (int) $row->likelihood);
        $this->assertSame('model v0', $row->source);
        $this->assertSame('alert', $row->reasons[0]['tone']);
    }

    public function test_bad_forecast_rows_get_a_json_error(): void
    {
        $this->withToken(self::TOKEN)
            ->postJson('/api/model/forecasts', ['forecasts' => [['week_start' => 'not-a-date']]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['forecasts.0.week_start', 'forecasts.0.risk_level']);
    }
}
