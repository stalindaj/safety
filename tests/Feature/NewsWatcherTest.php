<?php

namespace Tests\Feature;

use App\Models\ExternalOccurrence;
use App\Models\Mishap;
use App\Models\NewsDetection;
use App\Models\User;
use App\Support\EarlyWarning;
use App\Support\News\NewsReader;
use App\Support\News\NewsWatcher;
use App\Support\News\RelevanceModel;
use App\Support\News\Sources;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class NewsWatcherTest extends TestCase
{
    use RefreshDatabase;

    /** @param  list<array{0: string, 1: string, 2: string, 3: string}>  $items  [title, source name, domain, pubDate] */
    private function rss(array $items): string
    {
        $xml = '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>t</title>';
        foreach ($items as [$title, $source, $domain, $date]) {
            $xml .= '<item><title>'.htmlspecialchars("{$title} - {$source}").'</title>'
                .'<link>https://news.google.com/rss/articles/'.md5($title.$domain).'</link>'
                .'<guid isPermaLink="false">'.md5($title.$domain).'</guid>'
                .'<pubDate>'.Carbon::parse($date)->toRfc2822String().'</pubDate>'
                .'<source url="https://www.'.$domain.'">'.htmlspecialchars($source).'</source></item>';
        }

        return $xml.'</channel></rss>';
    }

    /** Google News returns these items; the direct feeds return nothing. No real requests leave the test. */
    private function fakeNews(array $items): void
    {
        Http::preventStrayRequests();
        $fakes = ['news.google.com/*' => Http::response($this->rss($items))];
        foreach (Sources::DIRECT_FEEDS as [$url]) {
            $fakes[parse_url($url, PHP_URL_HOST).'/*'] = Http::response($this->rss([]));
        }
        Http::fake($fakes);
    }

    public function test_the_reader_keeps_flying_occurrences_and_drops_the_rest(): void
    {
        $butuan = NewsReader::read('Incident: Cebu Pacific A21N at Butuan on Aug 9th 2026, runway excursion during line up - The Aviation Herald');
        $this->assertSame('incident', $butuan['kind']);
        $this->assertSame('mindanao', $butuan['region']);
        $this->assertSame('Butuan', $butuan['place']);   // the airline name is not the place

        $paf = NewsReader::read('6 bodies recovered from PAF chopper crash site in Agusan del Sur - Inquirer.net');
        $this->assertSame('accident', $paf['kind']);
        $this->assertTrue($paf['military']);

        $bronco = NewsReader::read('French OV-10 Bronco Damaged in Landing Gear-Up Accident During Polish Airshow Rehearsal');
        $this->assertSame('OV-10', $bronco['fleet_type']);   // our type, so kept even abroad

        $this->assertNull(NewsReader::read('Gokongwei, Gotianun face Swiss challenge for regional airport deal - Manila Bulletin'));
        $this->assertNull(NewsReader::read('3 dead after news helicopter crashes while covering Los Angeles bus collision - NBC News'));
        $this->assertNull(NewsReader::read('Today we honor the memory of the scouts whose plane crashed 63 years ago'));
    }

    public function test_only_trusted_sources_count(): void
    {
        $this->assertSame(Sources::OFFICIAL, Sources::trust('https://www.pna.gov.ph')['tier']);
        $this->assertSame(Sources::NEWS, Sources::trust('https://newsinfo.inquirer.net/123')['tier']);
        $this->assertSame(Sources::AVIATION, Sources::trust('avherald.com')['tier']);
        $this->assertNull(Sources::trust('https://www.dailymail.co.uk'));
        $this->assertNull(Sources::trust('https://facebook.com'));
        $this->assertNull(Sources::trust('https://notinquirer.net'));   // a look-alike domain is not a subdomain

        $this->assertTrue(NewsReader::quotesOfficial('PAF: FA-50 jet encountered generator issue'));
        $this->assertTrue(NewsReader::quotesOfficial('Habagat grounds 10 flights, CAAP says'));
        $this->assertTrue(NewsReader::quotesOfficial('2 flights cancelled due to habagat – Caap'));
        $this->assertFalse(NewsReader::quotesOfficial('Plane makes emergency landing in Cagayan town'));
    }

    public function test_verified_relevant_events_are_logged_automatically_and_the_rest_wait_or_stay_informational(): void
    {
        Carbon::setTestNow('2026-08-12 09:00');
        $this->fakeNews([
            // Mindanao, 2 newsrooms + an aviation-safety source → logged automatically
            ['Butuan Airport grounds flights', 'Daily Tribune', 'tribune.net.ph', '2026-08-10 02:00'],
            ['Landing and take-off operations at Butuan Airport temporarily suspended', 'BusinessMirror', 'businessmirror.com.ph', '2026-08-09 08:00'],
            ['Incident: Cebu Pacific A21N at Butuan on Aug 9th 2026, runway excursion during line up', 'The Aviation Herald', 'avherald.com', '2026-08-09 12:00'],
            // Military, one newsroom quoting the PAF → verified → logged
            ['PAF: FA-50 jet encountered generator issue while returning from Australia exercise', 'gmanetwork.com', 'gmanetwork.com', '2026-08-11 03:00'],
            // One newsroom, not quoting anyone → waits for a second source
            ['Plane makes emergency landing in Cagayan town; pilot, student safe', 'Manila Bulletin', 'mb.com.ph', '2026-08-11 05:00'],
            // Untrusted outlet → ignored entirely
            ['Video: Footage shows aftermath of fatal plane crash in the Philippines', 'Daily Mail', 'dailymail.co.uk', '2026-08-11 06:00'],
        ]);

        $stats = NewsWatcher::run();
        NewsWatcher::run();   // same articles again: nothing doubles, nothing logs twice

        $this->assertSame(count(NewsWatcher::QUERIES), $stats['untrusted']);   // the fake returns it for every search
        $this->assertSame(3, NewsDetection::count());
        $this->assertSame(2, ExternalOccurrence::count());

        $butuan = NewsDetection::query()->where('place', 'Butuan')->sole();
        $this->assertSame(NewsDetection::CONFIRMED, $butuan->status);
        $this->assertTrue($butuan->auto);
        $this->assertSame('aviation', $butuan->trust);
        $this->assertSame(3, $butuan->articles()->count());
        $this->assertStringContainsString('runway excursion', $butuan->headline);
        $log = $butuan->occurrence;
        $this->assertSame('mindanao', $log->region);
        $this->assertNull($log->created_by);
        $this->assertStringStartsWith('Incident: Cebu Pacific', $log->summary);
        $this->assertStringContainsString('logged automatically from The Aviation Herald', $log->summary);

        $fa50 = NewsDetection::query()->where('aircraft', 'FA-50')->sole();
        $this->assertSame(NewsDetection::CONFIRMED, $fa50->status);
        $this->assertSame('philippines', $fa50->occurrence->region);

        $cagayan = NewsDetection::query()->where('place', 'Cagayan')->sole();
        $this->assertSame(NewsDetection::WAITING, $cagayan->status);
        $this->assertNull($cagayan->external_occurrence_id);

        // A week with no second source: kept for information, never logged.
        Carbon::setTestNow('2026-08-20 09:00');
        $this->fakeNews([]);
        NewsWatcher::run();
        $this->assertSame(NewsDetection::INFO, $cagayan->fresh()->status);
    }

    public function test_a_failed_source_is_reported_not_fatal(): void
    {
        Http::preventStrayRequests();
        Http::fake(['*' => Http::response('down', 503)]);

        $stats = NewsWatcher::run();

        $this->assertCount(count(NewsWatcher::QUERIES) + count(Sources::DIRECT_FEEDS), $stats['errors']);
        $this->assertNotNull(NewsWatcher::lastCheck());
    }

    public function test_our_aircraft_in_mindanao_scores_highest(): void
    {
        $ours = NewsWatcher::scoreOf(['fleet_type' => 'AW-109', 'region' => 'mindanao', 'military' => true, 'kind' => 'accident', 'category' => 'Fire'], []);
        $far = NewsWatcher::scoreOf(['fleet_type' => null, 'region' => 'nearby', 'military' => false, 'kind' => 'accident', 'category' => 'Fire'], []);

        $this->assertSame(7, $ours['score']);
        $this->assertContains('Our aircraft type (AW-109)', $ours['why']);
        $this->assertLessThan(NewsWatcher::LOG_SCORE, $far['score']);   // a civil crash abroad isn't logged on its own
    }

    public function test_undo_removes_the_automatic_log_and_log_anyway_is_a_staff_decision(): void
    {
        $this->actingAs($user = User::factory()->create());
        $occurrence = ExternalOccurrence::create(['occurred_on' => '2026-08-09', 'region' => 'mindanao', 'location' => 'Butuan',
            'category' => 'Fire', 'summary' => 'x (logged automatically from GMA News)', 'brief_until' => '2026-09-08']);
        $auto = NewsDetection::factory()->create(['status' => NewsDetection::CONFIRMED, 'external_occurrence_id' => $occurrence->id]);
        $info = NewsDetection::factory()->create();

        $this->post("/news-detections/{$auto->id}/dismiss")->assertRedirect();
        $auto->refresh();
        $this->assertSame(NewsDetection::DISMISSED, $auto->status);
        $this->assertFalse($auto->auto);
        $this->assertSame($user->id, $auto->reviewed_by);
        $this->assertSame(0, ExternalOccurrence::count());   // the automatic log is gone

        $this->post('/external-occurrences', [
            'occurred_on' => '2026-08-09', 'region' => 'luzon', 'location' => 'Clark', 'category' => 'Hard / precautionary landing',
            'summary' => 'Emergency landing', 'news_detection_id' => $info->id,
        ])->assertRedirect();
        $info->refresh();
        $this->assertSame(NewsDetection::CONFIRMED, $info->status);
        $this->assertFalse($info->auto);

        // Removing a staff-logged occurrence from the Outside list also counts as "not relevant".
        $this->delete('/external-occurrences/'.$info->external_occurrence_id)->assertRedirect();
        $this->assertSame(NewsDetection::DISMISSED, $info->fresh()->status);
    }

    public function test_the_model_learns_only_from_staff_decisions(): void
    {
        $make = fn (string $headline, string $status, array $extra = []) => NewsDetection::factory()->create(
            ['headline' => $headline, 'status' => $status, 'auto' => false] + $extra);

        foreach (['PAF helicopter crash in Agusan', 'Air Force trainer aircraft crash in Benguet', 'PAF chopper emergency landing in Davao',
            'Military helicopter bird strike in Zamboanga', 'PAF jet engine trouble near Cotabato', 'Navy helicopter crash off Sulu'] as $h) {
            $make($h, NewsDetection::CONFIRMED, ['kind' => 'accident', 'military' => true, 'region' => 'mindanao']);
        }
        foreach (['LIST: Cancelled flights due to habagat', 'Bad weather disrupts Manila flights', 'Flights cancelled at NAIA',
            'Passengers stranded as flights cancelled', 'Romblon airport reopens for flights', 'Habagat cancels domestic flights'] as $h) {
            $make($h, NewsDetection::DISMISSED, ['kind' => 'disruption', 'military' => false, 'region' => 'luzon']);
        }
        // The watcher's own decisions are not lessons.
        NewsDetection::factory()->count(10)->create(['status' => NewsDetection::CONFIRMED, 'auto' => true]);

        $model = RelevanceModel::fromDatabase();
        $this->assertSame(['confirmed' => 6, 'dismissed' => 6], $model->examples());

        $crash = NewsDetection::factory()->make(['headline' => 'PAF helicopter crash in Bukidnon', 'kind' => 'accident', 'military' => true, 'region' => 'mindanao']);
        $noise = NewsDetection::factory()->make(['headline' => 'Flights cancelled due to habagat', 'kind' => 'disruption', 'military' => false, 'region' => 'luzon']);
        $this->assertGreaterThan(0.8, $model->probability(RelevanceModel::features($crash)));
        $this->assertLessThan(0.2, $model->probability(RelevanceModel::features($noise)));
        $this->assertContains('military: yes', $model->reasons(RelevanceModel::features($crash), 5)['up']);
    }

    public function test_once_trained_the_model_hands_a_doubtful_automatic_log_to_a_person(): void
    {
        foreach (range(1, 6) as $i) {
            NewsDetection::factory()->create(['headline' => "Airline flight diverted to Clark {$i}", 'status' => NewsDetection::DISMISSED,
                'auto' => false, 'region' => 'luzon', 'military' => false]);
            NewsDetection::factory()->create(['headline' => "PAF helicopter crash in Mindanao {$i}", 'status' => NewsDetection::CONFIRMED,
                'auto' => false, 'region' => 'mindanao', 'military' => true, 'kind' => 'accident']);
        }
        $doubtful = NewsDetection::factory()->create(['headline' => 'Airline flight diverted to Clark again', 'status' => NewsDetection::WAITING,
            'region' => 'luzon', 'score' => 2, 'military' => false]);
        $doubtful->articles()->create(['guid_hash' => sha1('a'), 'title' => 'Airline flight diverted to Clark again', 'source' => 'CAAP',
            'domain' => 'caap.gov.ph', 'tier' => Sources::OFFICIAL, 'url' => 'https://caap.gov.ph/x', 'published_at' => now()]);

        NewsWatcher::decide($doubtful->load('articles'), RelevanceModel::fromDatabase());

        $this->assertSame(NewsDetection::PENDING, $doubtful->status);   // rules said log; the model says a person should look
        $this->assertNull($doubtful->external_occurrence_id);
    }

    public function test_similar_occurrences_inside_and_outside_the_wing_make_a_pattern(): void
    {
        Mishap::factory()->create(['environment' => 'flight', 'mishap_date' => '2026-09-12', 'category' => 'Bird / wildlife strike', 'location' => 'LAB']);
        ExternalOccurrence::create(['occurred_on' => '2026-09-05', 'region' => 'mindanao', 'location' => 'Laguindingan', 'category' => 'Bird / wildlife strike',
            'summary' => 'Bird strike on approach', 'brief_until' => '2026-10-05']);
        ExternalOccurrence::create(['occurred_on' => '2026-08-01', 'region' => 'luzon', 'location' => 'Clark', 'category' => 'Bird / wildlife strike',
            'summary' => 'Too long ago', 'brief_until' => '2026-08-31']);

        $patterns = EarlyWarning::patterns(Carbon::parse('2026-09-14'));

        $this->assertCount(1, $patterns);
        $this->assertSame('2 similar occurrences in 8 days: bird / wildlife strike', $patterns[0]['text']);
        $this->assertSame('brief', $patterns[0]['level']);
        $this->assertStringContainsString('1 in the Wing, 1 outside', $patterns[0]['detail']);
    }

    public function test_the_forecast_page_carries_the_news_watcher(): void
    {
        Http::fake(['aviationweather.gov/*' => Http::response('', 503)]);
        $this->actingAs(User::factory()->create());
        NewsDetection::factory()->create(['headline' => 'PAF chopper emergency landing in Davao', 'status' => NewsDetection::WAITING]);

        $this->get('/forecast')->assertOk()->assertInertia(fn ($page) => $page
            ->where('early_warning.news.waiting.0.headline', 'PAF chopper emergency landing in Davao')
            ->where('early_warning.news.waiting.0.backing.verified', false)
            ->where('early_warning.news.model.ready', false)
            ->has('early_warning.news.sources.feeds', count(Sources::DIRECT_FEEDS))
            ->has('early_warning.patterns'));
    }
}
