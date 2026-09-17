<?php

namespace App\Support\News;

/**
 * Which sources the watcher trusts. Anything not on these lists (social
 * media, tabloids, content farms, local TV from other countries) is ignored.
 *
 * - official: government, military and investigation bodies
 * - aviation: specialist aviation-safety reporting
 * - news:     established national and regional newsrooms
 *
 * An event counts as verified with one official or aviation source, or two
 * independent newsrooms.
 */
class Sources
{
    public const OFFICIAL = 'official';

    public const AVIATION = 'aviation';

    public const NEWS = 'news';

    public const LABELS = [
        self::OFFICIAL => 'Official',
        self::AVIATION => 'Aviation safety source',
        self::NEWS => 'Major news',
    ];

    /** Domain (matched on its end, so subdomains count) => [tier, display name]. */
    private const TRUSTED = [
        // Official — Philippines
        'caap.gov.ph' => [self::OFFICIAL, 'CAAP'],
        'pna.gov.ph' => [self::OFFICIAL, 'Philippine News Agency'],
        'pia.gov.ph' => [self::OFFICIAL, 'Philippine Information Agency'],
        'paf.mil.ph' => [self::OFFICIAL, 'Philippine Air Force'],
        'afp.mil.ph' => [self::OFFICIAL, 'Armed Forces of the Philippines'],
        'navy.mil.ph' => [self::OFFICIAL, 'Philippine Navy'],
        'army.mil.ph' => [self::OFFICIAL, 'Philippine Army'],
        'dnd.gov.ph' => [self::OFFICIAL, 'Department of National Defense'],
        'dotr.gov.ph' => [self::OFFICIAL, 'DOTr'],
        'coastguard.gov.ph' => [self::OFFICIAL, 'Philippine Coast Guard'],
        'ndrrmc.gov.ph' => [self::OFFICIAL, 'NDRRMC'],
        'pagasa.dost.gov.ph' => [self::OFFICIAL, 'PAGASA'],
        'pco.gov.ph' => [self::OFFICIAL, 'Presidential Communications Office'],
        'philippineairlines.com' => [self::OFFICIAL, 'Philippine Airlines'],
        'cebupacificair.com' => [self::OFFICIAL, 'Cebu Pacific'],
        // Official — elsewhere
        'ntsb.gov' => [self::OFFICIAL, 'NTSB'],
        'faa.gov' => [self::OFFICIAL, 'FAA'],
        'icao.int' => [self::OFFICIAL, 'ICAO'],
        'easa.europa.eu' => [self::OFFICIAL, 'EASA'],
        'knkt.go.id' => [self::OFFICIAL, 'KNKT Indonesia'],
        'mot.gov.my' => [self::OFFICIAL, 'Ministry of Transport Malaysia'],
        'caam.gov.my' => [self::OFFICIAL, 'CAAM Malaysia'],
        'uscg.mil' => [self::OFFICIAL, 'US Coast Guard'],
        'dvidshub.net' => [self::OFFICIAL, 'DVIDS (US military)'],
        // Aviation safety
        'avherald.com' => [self::AVIATION, 'The Aviation Herald'],
        'aviation-safety.net' => [self::AVIATION, 'Aviation Safety Network'],
        'flightglobal.com' => [self::AVIATION, 'FlightGlobal'],
        'aviationweek.com' => [self::AVIATION, 'Aviation Week'],
        'aerotime.aero' => [self::AVIATION, 'AeroTime'],
        'janes.com' => [self::AVIATION, 'Janes'],
        'flightsafety.org' => [self::AVIATION, 'Flight Safety Foundation'],
        'skybrary.aero' => [self::AVIATION, 'SKYbrary'],
        // Major news — Philippines
        'inquirer.net' => [self::NEWS, 'Inquirer'],
        'gmanetwork.com' => [self::NEWS, 'GMA News'],
        'abs-cbn.com' => [self::NEWS, 'ABS-CBN News'],
        'philstar.com' => [self::NEWS, 'Philstar'],
        'mb.com.ph' => [self::NEWS, 'Manila Bulletin'],
        'rappler.com' => [self::NEWS, 'Rappler'],
        'manilatimes.net' => [self::NEWS, 'The Manila Times'],
        'businessmirror.com.ph' => [self::NEWS, 'BusinessMirror'],
        'bworldonline.com' => [self::NEWS, 'BusinessWorld'],
        'tribune.net.ph' => [self::NEWS, 'Daily Tribune'],
        'sunstar.com.ph' => [self::NEWS, 'SunStar'],
        'mindanews.com' => [self::NEWS, 'MindaNews'],
        'mindanaotimes.com.ph' => [self::NEWS, 'Mindanao Times'],
        'news5.com.ph' => [self::NEWS, 'News5'],
        'onenews.ph' => [self::NEWS, 'One News'],
        'bomboradyo.com' => [self::NEWS, 'Bombo Radyo'],
        'brigada.ph' => [self::NEWS, 'Brigada News'],
        'dzrh.com.ph' => [self::NEWS, 'DZRH'],
        'ptvnews.ph' => [self::NEWS, 'PTV News'],
        // Major news — region and wire services
        'reuters.com' => [self::NEWS, 'Reuters'],
        'apnews.com' => [self::NEWS, 'Associated Press'],
        'afp.com' => [self::NEWS, 'AFP'],
        'bbc.com' => [self::NEWS, 'BBC'],
        'bbc.co.uk' => [self::NEWS, 'BBC'],
        'aljazeera.com' => [self::NEWS, 'Al Jazeera'],
        'theguardian.com' => [self::NEWS, 'The Guardian'],
        'channelnewsasia.com' => [self::NEWS, 'CNA'],
        'straitstimes.com' => [self::NEWS, 'The Straits Times'],
        'thestar.com.my' => [self::NEWS, 'The Star (Malaysia)'],
        'nst.com.my' => [self::NEWS, 'New Straits Times'],
        'bernama.com' => [self::NEWS, 'Bernama'],
        'malaymail.com' => [self::NEWS, 'Malay Mail'],
        'thejakartapost.com' => [self::NEWS, 'The Jakarta Post'],
        'tempo.co' => [self::NEWS, 'Tempo'],
        'antaranews.com' => [self::NEWS, 'Antara'],
        'vnexpress.net' => [self::NEWS, 'VnExpress'],
        'bangkokpost.com' => [self::NEWS, 'Bangkok Post'],
        'nationthailand.com' => [self::NEWS, 'The Nation Thailand'],
        'scmp.com' => [self::NEWS, 'South China Morning Post'],
        'asia.nikkei.com' => [self::NEWS, 'Nikkei Asia'],
        'taipeitimes.com' => [self::NEWS, 'Taipei Times'],
        'focustaiwan.tw' => [self::NEWS, 'Focus Taiwan'],
        'abc.net.au' => [self::NEWS, 'ABC Australia'],
        'nytimes.com' => [self::NEWS, 'The New York Times'],
        'washingtonpost.com' => [self::NEWS, 'The Washington Post'],
        'cnn.com' => [self::NEWS, 'CNN'],
    ];

    /**
     * Feeds read directly (not through Google News): label => [url, domain].
     * Checked 2026-09-17; PNA, PIA and the Aviation Safety Network block
     * automated readers, and The Aviation Herald's robots.txt asks robots to
     * stay out, so those only arrive when Google News carries them.
     */
    public const DIRECT_FEEDS = [
        'CAAP' => ['https://caap.gov.ph/feed/', 'caap.gov.ph'],
        'Inquirer' => ['https://newsinfo.inquirer.net/feed', 'inquirer.net'],
        'GMA News' => ['https://data.gmanetwork.com/gno/rss/news/nation/feed.xml', 'gmanetwork.com'],
        'Philstar' => ['https://www.philstar.com/rss/nation', 'philstar.com'],
        'Rappler' => ['https://www.rappler.com/nation/feed/', 'rappler.com'],
    ];

    /** "https://newsinfo.inquirer.net/123" or "www.inquirer.net" → "newsinfo.inquirer.net". */
    public static function host(?string $url): ?string
    {
        if (! $url) {
            return null;
        }
        $host = parse_url(str_contains($url, '://') ? $url : "https://{$url}", PHP_URL_HOST);

        return $host ? preg_replace('/^www\./', '', strtolower($host)) : null;
    }

    /**
     * The trusted entry for a web address, or null if it isn't trusted.
     *
     * @return array{domain: string, tier: string, name: string}|null
     */
    public static function trust(?string $url): ?array
    {
        $host = self::host($url);
        if (! $host) {
            return null;
        }
        foreach (self::TRUSTED as $domain => [$tier, $name]) {
            if ($host === $domain || str_ends_with($host, '.'.$domain)) {
                return ['domain' => $domain, 'tier' => $tier, 'name' => $name];
            }
        }

        return null;
    }

    /**
     * How well an event is backed up, from its articles' tiers and domains.
     *
     * @param  iterable<array{tier: string, domain: string, title?: string}>  $articles
     * @return array{verified: bool, level: string, label: string, outlets: int}
     */
    public static function corroboration(iterable $articles): array
    {
        $tiers = [];
        $domains = [];
        $quoted = false;
        foreach ($articles as $a) {
            $tiers[$a['tier']] = true;
            $domains[$a['domain']] = true;
            $quoted = $quoted || NewsReader::quotesOfficial($a['title'] ?? '');
        }
        $outlets = count($domains);

        return match (true) {
            isset($tiers[self::OFFICIAL]) => ['verified' => true, 'level' => self::OFFICIAL, 'label' => 'Official source', 'outlets' => $outlets],
            isset($tiers[self::AVIATION]) => ['verified' => true, 'level' => self::AVIATION, 'label' => 'Aviation safety source', 'outlets' => $outlets],
            $quoted => ['verified' => true, 'level' => self::OFFICIAL, 'label' => 'Newsroom quoting an official body', 'outlets' => $outlets],
            $outlets >= 2 => ['verified' => true, 'level' => 'outlets', 'label' => "{$outlets} independent newsrooms", 'outlets' => $outlets],
            default => ['verified' => false, 'level' => 'single', 'label' => '1 newsroom so far', 'outlets' => $outlets],
        };
    }
}
