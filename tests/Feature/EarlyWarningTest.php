<?php

namespace Tests\Feature;

use App\Models\ExternalOccurrence;
use App\Models\Mishap;
use App\Models\User;
use App\Support\AirfieldWeather;
use App\Support\EarlyWarning;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class EarlyWarningTest extends TestCase
{
    use RefreshDatabase;

    /** Real report formats from the feed (Mactan with CB and lightning). */
    private function fakeWeather(): void
    {
        Http::fake([
            'aviationweather.gov/api/data/metar*' => Http::response([
                ['icaoId' => 'RPVM', 'obsTime' => 1789315200, 'wxString' => null, 'visib' => '6+', 'wspd' => 3, 'wgst' => null,
                    'rawOb' => 'METAR RPVM 131600Z 10003KT 9999 SCT011 SCT018 BKN038 27/25 Q1011 NOSIG RMK A2985 CB/OCNL LTG N'],
                ['icaoId' => 'RPMZ', 'obsTime' => 1789311600, 'wxString' => 'HZ', 'visib' => 1.5, 'wspd' => 12, 'wgst' => 28,
                    'rawOb' => 'METAR RPMZ 131500Z 12012G28KT 2400 HZ FEW017 25/24 Q1012'],
                ['icaoId' => 'RPLL', 'obsTime' => 1789315200, 'wxString' => null, 'visib' => '6+', 'wspd' => 4, 'wgst' => null,
                    'rawOb' => 'METAR RPLL 131600Z 03004KT 9999 FEW025 28/25 Q1011 NOSIG'],
            ]),
            'aviationweather.gov/api/data/taf*' => Http::response([
                ['icaoId' => 'RPMD', 'validTimeTo' => 1789387200,
                    'rawTAF' => 'TAF RPMD 131100Z 1312/1412 VRB02KT 9999 FEW016 TEMPO 1312/1318 -SHRA FEW015CB BKN090',
                    'fcsts' => [['wxString' => null, 'visib' => '6+', 'wspd' => 2], ['wxString' => '-SHRA', 'visib' => '', 'wspd' => null]]],
            ]),
        ]);
    }

    public function test_airfield_weather_turns_reports_into_plain_hazards(): void
    {
        $this->fakeWeather();
        $w = collect(AirfieldWeather::fetch()['stations'])->keyBy('id');

        // Lightning in the remarks = thunderstorms = brief crews.
        $this->assertSame('brief', $w['RPVM']['level']);
        $this->assertContains('Thunderstorms', array_column($w['RPVM']['now'], 'text'));

        $zam = array_column($w['RPMZ']['now'], 'text');
        $this->assertContains('Gusts 28 kt', $zam);
        $this->assertContains('Low visibility (2.4 km)', $zam);
        $this->assertSame('Mindanao', $w['RPMZ']['region']);

        $this->assertSame('clear', $w['RPLL']['level']);

        // Routine "TEMPO … CB" in a forecast is worth knowing, not a reason to brief.
        $this->assertContains('CB clouds expected at times', array_column($w['RPMD']['next'], 'text'));
        $this->assertSame('aware', $w['RPMD']['level']);
        $this->assertFalse($w['RPMD']['reporting']);
    }

    public function test_the_dashboard_still_loads_when_the_weather_service_is_down(): void
    {
        Http::fake(['aviationweather.gov/*' => Http::response('', 503)]);
        $this->actingAs(User::factory()->create());

        $this->get('/')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Dashboard')
            ->where('early_warning.weather.available', false));
    }

    public function test_an_outside_occurrence_matching_the_wing_is_flagged_to_brief(): void
    {
        $this->actingAs(User::factory()->create());
        Mishap::factory()->count(2)->create(['environment' => 'flight', 'category' => 'Bird / wildlife strike']);

        $this->post('/external-occurrences', [
            'occurred_on' => now()->subDays(2)->toDateString(),
            'region' => 'mindanao',
            'location' => 'Laguindingan',
            'aircraft' => 'aw 109',
            'category' => 'Bird / wildlife strike',
            'summary' => 'Bird strike on approach; landed safely.',
        ])->assertSessionHasNoErrors();

        $o = ExternalOccurrence::sole();
        $this->assertSame(now()->subDays(2)->addDays(30)->toDateString(), $o->brief_until->toDateString());

        $item = EarlyWarning::external()[0];
        $this->assertSame('brief', $item['level']);
        $this->assertSame(['Our aircraft type', 'Mindanao', 'One of our top causes'], $item['why']);
        $this->assertTrue($item['active']);
    }

    public function test_an_unrelated_occurrence_is_information_only_and_expires(): void
    {
        $this->actingAs(User::factory()->create());
        ExternalOccurrence::create([
            'occurred_on' => '2026-06-01', 'region' => 'luzon', 'location' => 'Clark', 'aircraft' => 'Cessna 172',
            'category' => 'Weather', 'summary' => 'Crosswind excursion.', 'brief_until' => '2026-07-01',
        ]);

        $item = EarlyWarning::external(Carbon::parse('2026-07-15'))[0];
        $this->assertSame('info', $item['level']);
        $this->assertFalse($item['active']);
    }

    public function test_logging_requires_the_essentials_and_no_future_dates(): void
    {
        $this->actingAs(User::factory()->create());

        $this->post('/external-occurrences', [
            'occurred_on' => now()->addDay()->toDateString(),
            'region' => 'mars',
        ])->assertSessionHasErrors(['occurred_on', 'region', 'location', 'category', 'summary']);
    }

    public function test_the_chances_are_how_often_it_happened_in_the_last_five_years(): void
    {
        Mishap::factory()->create(['environment' => 'flight', 'mishap_date' => '2024-03-05', 'category' => 'Bird / wildlife strike']);
        Mishap::factory()->create(['environment' => 'ground', 'mishap_date' => '2025-06-10', 'category' => 'Fire']);
        Mishap::factory()->create(['environment' => 'flight', 'mishap_date' => '2016-02-02', 'category' => 'Fire']); // outside the 5 years

        $o = EarlyWarning::odds(Carbon::parse('2026-09-14'));

        // Weeks from Mon 13 Sep 2021 to the week before 14 Sep 2026.
        $this->assertSame(261, $o['flight_week']['weeks']);
        $this->assertSame(1, $o['flight_week']['hits']);
        $this->assertSame(2, $o['any_week']['hits']);
        // September is in the southbound bird window, so the bird chance is seasonal.
        $this->assertSame('Sep–Nov weeks since 2016', $o['bird_week']['label']);
    }

    public function test_the_season_uses_the_wings_own_bird_strike_history(): void
    {
        Mishap::factory()->create(['category' => 'Bird / wildlife strike', 'mishap_date' => '2024-10-05']);
        Mishap::factory()->create(['category' => 'Bird / wildlife strike', 'mishap_date' => '2025-03-10']);

        $items = collect(EarlyWarning::season(Carbon::parse('2026-09-14')))->keyBy('text');

        $bird = $items['Bird migration — southbound peak (Sep–Nov)'];
        $this->assertStringContainsString("1 of the Wing's 2", $bird['detail']);
        $this->assertSame('Bird / wildlife strike', $bird['chance']['what']);
        // One strike is too little evidence to call a season riskier.
        $this->assertSame('too few to tell', $bird['chance']['verdict']);
        $this->assertSame('aware', $bird['level']);
        $this->assertTrue($items->has('Southwest monsoon (Habagat)'));
    }
}
