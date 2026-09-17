<?php

namespace Tests\Feature;

use App\Models\Mishap;
use App\Models\WatcherReport;
use App\Support\ChanceModel;
use App\Support\EarlyWarning;
use App\Support\Enso;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ChanceModelTest extends TestCase
{
    use RefreshDatabase;

    private const ONI = <<<'TXT'
 SEAS  YR   TOTAL   ANOM
  JJA 2025  27.10  -0.20
  JAS 2025  27.00   0.60
  ASO 2025  27.00   0.70
  MJJ 2026  29.02   1.39
  JJA 2026  29.09   1.80
TXT;

    /** @return list<array<string, mixed>> */
    private function weeks(int $count, int $hits): array
    {
        return array_map(fn ($i) => ['start' => Carbon::parse('2020-01-06')->addWeeks($i), 'flight' => $i < $hits, 'any' => $i < $hits, 'bird' => false],
            range(0, $count - 1));
    }

    public function test_noaa_oni_is_read_by_season_and_state(): void
    {
        $parsed = Enso::parse(self::ONI);

        $this->assertSame(1.8, $parsed['values']['2026-07']);          // JJA is centred on July
        $this->assertSame(['season' => 'Jun–Aug 2026', 'anomaly' => 1.8], $parsed['latest']);
        $this->assertSame('el_nino', Enso::state(0.6));
        $this->assertSame('neutral', Enso::state(-0.2));
        $this->assertSame('strong', Enso::strength(1.8));
    }

    public function test_a_condition_with_little_evidence_is_pulled_toward_no_effect(): void
    {
        // 20% of all weeks; 2 of 4 condition weeks (50%) is a big jump on very little evidence.
        $weeks = $this->weeks(100, 20);   // weeks 0–19 had a mishap
        $picked = array_map(fn ($i) => $weeks[$i]['start']->toDateString(), [18, 19, 20, 21]);   // 2 with, 2 without
        $e = ChanceModel::weeklyEffect($weeks, 'flight', fn ($w) => in_array($w['start']->toDateString(), $picked, true));

        $this->assertSame(4, $e['weeks']);
        $this->assertEqualsWithDelta(2.5, $e['raw'], 0.01);               // what the 4 weeks alone say
        $this->assertLessThan(1.3, $e['multiplier']);                     // what we actually use
        $this->assertGreaterThan(1.0, $e['multiplier']);
    }

    public function test_factors_move_the_chance_and_each_move_is_accounted_for(): void
    {
        $result = ChanceModel::combine(['pct' => 10.0, 'hits' => 26, 'weeks' => 261], [
            ['key' => 'season', 'label' => 'Habagat', 'multiplier' => 1.2, 'raw' => 1.4, 'detail' => '…'],
            ['key' => 'weather', 'label' => 'Bad weather', 'multiplier' => 0.9, 'raw' => 0.86, 'detail' => '…'],
            ['key' => 'outside', 'label' => 'Outside occurrences', 'multiplier' => null, 'detail' => 'Not counted yet'],
        ]);

        $this->assertSame(10.0, $result['base_pct']);
        $this->assertSame(10.7, $result['pct']);                          // odds 1/9 × 1.2 × 0.9
        $this->assertSame(1.08, $result['multiplier']);
        $this->assertEqualsWithDelta($result['pct'] - $result['base_pct'], array_sum(array_column($result['factors'], 'points')), 0.15);
        $this->assertSame('Outside occurrences', $result['pending'][0]['label']);
    }

    public function test_the_total_change_is_capped(): void
    {
        $result = ChanceModel::combine(['pct' => 10.0], [
            ['key' => 'a', 'label' => 'a', 'multiplier' => 3.0, 'raw' => 3.0, 'detail' => ''],
            ['key' => 'b', 'label' => 'b', 'multiplier' => 3.0, 'raw' => 3.0, 'detail' => ''],
        ]);

        $this->assertSame(2.0, $result['multiplier']);
        $this->assertSame(18.2, $result['pct']);
    }

    public function test_this_weeks_chances_use_season_el_nino_weather_and_hold_back_outside_occurrences(): void
    {
        Http::fake([Enso::URL => Http::response(self::ONI)]);
        Mishap::factory()->create(['environment' => 'flight', 'mishap_date' => '2026-07-14', 'category' => 'Fire']);
        Mishap::factory()->create(['environment' => 'flight', 'mishap_date' => '2025-08-20', 'category' => 'Bird / wildlife strike']);
        WatcherReport::create(['kind' => WatcherReport::WEATHER_LINK, 'generated_at' => now(), 'payload' => ['rows' => [
            ['group' => 'flight', 'hazard' => 'Any brief-level weather', 'mishap_hits' => 14, 'mishap_days' => 54, 'mishap_pct' => 25.9, 'usual_pct' => 30.1, 'verdict' => 'same as usual'],
        ]]]);
        $weather = ['available' => true, 'stations' => [['name' => 'Davao', 'level' => 'brief'], ['name' => 'Zamboanga', 'level' => 'aware']]];

        $today = Carbon::parse('2026-09-17');
        $odds = ChanceModel::adjust(EarlyWarning::odds($today), $weather, $today);
        $flight = $odds['flight_week'];

        $keys = array_column($flight['factors'], 'key');
        $this->assertSame(['season', 'enso', 'weather'], $keys);
        $this->assertStringContainsString('El Niño, strong (ONI +1.8, Jun–Aug 2026)', $flight['factors'][1]['label']);
        $this->assertStringContainsString('Davao', $flight['factors'][2]['label']);
        $this->assertLessThan(1.0, $flight['factors'][2]['multiplier']);    // measured: lower on bad-weather days
        $this->assertSame('Occurrences outside the Wing (last 14 days)', $flight['pending'][0]['label']);

        // Bird strikes: no weather factor; season uses the migration window.
        $this->assertSame(['season', 'enso'], array_column($odds['bird_week']['factors'], 'key'));
        $this->assertStringContainsString('southbound', $odds['bird_week']['factors'][0]['label']);
    }
}
