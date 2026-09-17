<?php

namespace App\Support\News;

use App\Support\HazardClassifier;

/**
 * Reads one news headline and decides whether it is a flying-related
 * occurrence, and if so what kind, where, which aircraft, and which hazard
 * category. Plain keyword rules: every decision can be traced to a word in the
 * headline. Returns null for everything that isn't about flying safety
 * (airport upgrades, route launches, memorials, fact-checks…).
 */
class NewsReader
{
    /** The headline has to be about flying at all. */
    private const AVIATION = [
        'plane', 'planes', 'aircraft', 'airplane', 'aeroplane', 'helicopter', 'helicopters', 'chopper', 'choppers',
        'jet', 'jets', 'fighter', 'flight', 'flights', 'airport', 'airports', 'airline', 'airlines', 'pilot', 'pilots',
        'runway', 'drone', 'drones', 'air force', 'paf', 'caap', 'naia', 'cessna', 'airbus', 'boeing', 'atr',
        'black hawk', 'huey', 'super tucano', 'tucano', 'bronco', 'airshow', 'aviation', 'airspace', 'notam',
        'eroplano', 'helikopter', 'piloto', 'trainer aircraft', 'seaplane', 'gyrocopter', 'ultralight', 'glider',
    ];

    /** Not an occurrence even when the words match. */
    private const EXCLUDE = [
        'anniversary', 'memorial day', 'years ago', 'decades ago', 'world war', 'wwii', 'fact check', 'fact-check',
        'old footage', 'old video', 'britannica', 'movie', 'film', 'trailer', 'video game', 'simulator', 'sale',
        'promo', 'seat sale', 'swiss challenge', 'ppp', 'lounge', 'tourism', 'hiring', 'recruitment', 'stock',
        'shares', 'earnings', 'profit', 'ticket price', 'fare', 'fares', 'car crash', 'road crash', 'motorcycle',
        'ransomware', 'cyber', 'cyberattack', 'data breach', 'stock market', 'crypto', 'lookback', 'on this day',
    ];

    /** Kinds, checked in this order: the first that matches wins. */
    private const KIND_RULES = [
        'accident' => [
            'crash', 'crashes', 'crashed', 'crash-lands', 'crash-landed', 'crash landing', 'crash-landing',
            'went down', 'goes down', 'lost contact', 'loses contact', 'missing plane', 'missing aircraft',
            'missing helicopter', 'wreckage', 'ditched', 'ditching', 'mid-air collision', 'midair collision',
            'bumagsak', 'nag-crash', 'plane down', 'shot down', 'killed in', 'dies in', 'dead in',
        ],
        'incident' => [
            'emergency landing', 'forced landing', 'precautionary landing', 'runway excursion', 'overshot',
            'overran', 'overshoots', 'skidded', 'skids off', 'veered off', 'veers off', 'bird strike', 'bird strikes',
            'birdstrike', 'engine failure', 'engine fire', 'engine trouble', 'engine issue', 'engine problem',
            'engine shutdown', 'pressurization', 'pressurisation', 'smoke', 'tyre burst', 'tire burst', 'burst tyre',
            'blown tire', 'turned back', 'turns back', 'returned to', 'returns to', 'gear-up', 'gear up landing',
            'near miss', 'near-miss', 'close call', 'near collision', 'hard landing', 'tail strike', 'turbulence',
            'laser', 'generator issue', 'technical issue', 'technical problem', 'mechanical issue', 'mechanical problem',
            'disabled aircraft', 'stuck on runway', 'grounded', 'grounds', 'grounding', 'sumadsad', 'aberya',
            'mayday', 'diverted due to', 'lightning strike', 'struck by lightning', 'incident:', 'accident:',
        ],
        'disruption' => [
            'flights cancelled', 'flights canceled', 'cancelled flights', 'canceled flights', 'flights suspended',
            'suspends', 'suspended', 'suspension', 'closed', 'closure', 'shut down', 'halts operations',
            'halts flights', 'flights affected', 'diverted', 'diversion', 'notam', 'stranded', 'delayed flights',
            'disrupts', 'disrupted', 'disruption', 'disruptions', 'cancelled', 'canceled', 'cancels', 'reopens',
        ],
        'hazard' => [
            'bird hazard', 'wildlife hazard', 'volcanic ash', 'ash cloud', 'eruption', 'drone sighting', 'unauthorized drone',
            'flares', 'jamming', 'gps interference', 'wind shear', 'thunderstorm',
        ],
    ];

    /** Our fleet: news words that point to each of our aircraft types. */
    private const FLEET = [
        'A-29B ST' => ['super tucano', 'a-29', 'a29', 'emb-314', 'emb 314'],
        'AW-109' => ['aw109', 'aw-109', 'aw 109', 'a109', 'agusta'],
        'SF-260TP' => ['sf-260', 'sf260', 'sf 260'],
        'MD-520MG' => ['md-520', 'md 520', 'md520'],
        'MD-500ER' => ['md-500', 'md 500', 'md500', 'md-530', 'md 530', 'md530'],
        'OV-10' => ['ov-10', 'ov10', 'bronco'],
        'T-129 ATAK' => ['t129', 't-129', 'atak'],
    ];

    /** Other types worth naming in a detection. */
    private const OTHER_TYPES = [
        'Black Hawk' => ['black hawk', 's-70i', 'uh-60'], 'Huey' => ['huey', 'uh-1'], 'FA-50' => ['fa-50'],
        'C-130' => ['c-130', 'hercules'], 'C-295' => ['c-295', 'c295'], 'Cessna' => ['cessna'], 'Robinson' => ['robinson'],
        'Bell 412' => ['bell 412'], 'ATR' => ['atr 72', 'atr72', 'atr'], 'Airbus' => ['airbus', 'a320', 'a321', 'a21n', 'a330', 'a350'],
        'Boeing' => ['boeing', '737', '777', '787'], 'Drone' => ['drone', 'uav'], 'Trainer aircraft' => ['trainer aircraft', 'trainer plane'],
        'Helicopter' => ['helicopter', 'chopper', 'helikopter'],
    ];

    private const MILITARY = [
        'air force', 'paf', 'navy', 'army', 'military', 'afp', 'armed forces', 'coast guard', 'pcg', 'pnp',
        'police', 'marine', 'marines', 'defense', 'defence', 'fighter', 'fighter jet', 'airmen', 'airman', 'soldiers', 'troops',
    ];

    /**
     * Place word => [display name, region]. Longer names are tried first, so
     * "Cagayan de Oro" wins over "Cagayan".
     */
    private const PLACES = [
        // Mindanao
        'mindanao' => ['Mindanao', 'mindanao'], 'davao' => ['Davao', 'mindanao'], 'zamboanga' => ['Zamboanga', 'mindanao'],
        'cagayan de oro' => ['Cagayan de Oro', 'mindanao'], 'cdo' => ['Cagayan de Oro', 'mindanao'], 'laguindingan' => ['Laguindingan', 'mindanao'],
        'lumbia' => ['Lumbia', 'mindanao'], 'cotabato' => ['Cotabato', 'mindanao'], 'general santos' => ['General Santos', 'mindanao'],
        'gensan' => ['General Santos', 'mindanao'], 'butuan' => ['Butuan', 'mindanao'], 'surigao' => ['Surigao', 'mindanao'],
        'siargao' => ['Siargao', 'mindanao'], 'agusan' => ['Agusan', 'mindanao'], 'bukidnon' => ['Bukidnon', 'mindanao'],
        'malaybalay' => ['Malaybalay', 'mindanao'], 'jolo' => ['Jolo', 'mindanao'], 'sulu' => ['Sulu', 'mindanao'],
        'basilan' => ['Basilan', 'mindanao'], 'tawi-tawi' => ['Tawi-Tawi', 'mindanao'], 'dipolog' => ['Dipolog', 'mindanao'],
        'pagadian' => ['Pagadian', 'mindanao'], 'iligan' => ['Iligan', 'mindanao'], 'lanao' => ['Lanao', 'mindanao'],
        'marawi' => ['Marawi', 'mindanao'], 'misamis' => ['Misamis', 'mindanao'], 'ozamiz' => ['Ozamiz', 'mindanao'],
        'camiguin' => ['Camiguin', 'mindanao'], 'sarangani' => ['Sarangani', 'mindanao'], 'maguindanao' => ['Maguindanao', 'mindanao'],
        'barmm' => ['BARMM', 'mindanao'], 'caraga' => ['Caraga', 'mindanao'], 'koronadal' => ['Koronadal', 'mindanao'],
        'tandag' => ['Tandag', 'mindanao'], 'digos' => ['Digos', 'mindanao'], 'sultan kudarat' => ['Sultan Kudarat', 'mindanao'],
        // Visayas
        'visayas' => ['Visayas', 'visayas'], 'cebu' => ['Cebu', 'visayas'], 'mactan' => ['Mactan', 'visayas'],
        'iloilo' => ['Iloilo', 'visayas'], 'bacolod' => ['Bacolod', 'visayas'], 'negros' => ['Negros', 'visayas'],
        'kanlaon' => ['Kanlaon', 'visayas'], 'tacloban' => ['Tacloban', 'visayas'], 'leyte' => ['Leyte', 'visayas'],
        'samar' => ['Samar', 'visayas'], 'bohol' => ['Bohol', 'visayas'], 'tagbilaran' => ['Tagbilaran', 'visayas'],
        'panglao' => ['Panglao', 'visayas'], 'dumaguete' => ['Dumaguete', 'visayas'], 'kalibo' => ['Kalibo', 'visayas'],
        'boracay' => ['Boracay', 'visayas'], 'caticlan' => ['Caticlan', 'visayas'], 'roxas city' => ['Roxas City', 'visayas'],
        'antique' => ['Antique', 'visayas'], 'guimaras' => ['Guimaras', 'visayas'], 'siquijor' => ['Siquijor', 'visayas'],
        'ormoc' => ['Ormoc', 'visayas'], 'catarman' => ['Catarman', 'visayas'], 'calbayog' => ['Calbayog', 'visayas'],
        // Luzon (incl. MIMAROPA / Palawan)
        'luzon' => ['Luzon', 'luzon'], 'manila' => ['Manila', 'luzon'], 'naia' => ['NAIA', 'luzon'], 'pasay' => ['Pasay', 'luzon'],
        'clark' => ['Clark', 'luzon'], 'pampanga' => ['Pampanga', 'luzon'], 'subic' => ['Subic', 'luzon'], 'bataan' => ['Bataan', 'luzon'],
        'zambales' => ['Zambales', 'luzon'], 'cavite' => ['Cavite', 'luzon'], 'sangley' => ['Sangley', 'luzon'],
        'batangas' => ['Batangas', 'luzon'], 'lipa' => ['Lipa', 'luzon'], 'laguna' => ['Laguna', 'luzon'], 'quezon' => ['Quezon', 'luzon'],
        'bicol' => ['Bicol', 'luzon'], 'legazpi' => ['Legazpi', 'luzon'], 'albay' => ['Albay', 'luzon'], 'naga' => ['Naga', 'luzon'],
        'sorsogon' => ['Sorsogon', 'luzon'], 'masbate' => ['Masbate', 'luzon'], 'catanduanes' => ['Catanduanes', 'luzon'],
        'benguet' => ['Benguet', 'luzon'], 'baguio' => ['Baguio', 'luzon'], 'la union' => ['La Union', 'luzon'],
        'ilocos' => ['Ilocos', 'luzon'], 'laoag' => ['Laoag', 'luzon'], 'vigan' => ['Vigan', 'luzon'], 'pangasinan' => ['Pangasinan', 'luzon'],
        'tarlac' => ['Tarlac', 'luzon'], 'nueva ecija' => ['Nueva Ecija', 'luzon'], 'bulacan' => ['Bulacan', 'luzon'],
        'isabela' => ['Isabela', 'luzon'], 'cauayan' => ['Cauayan', 'luzon'], 'tuguegarao' => ['Tuguegarao', 'luzon'],
        'cagayan' => ['Cagayan', 'luzon'], 'aurora' => ['Aurora', 'luzon'], 'palawan' => ['Palawan', 'luzon'], 'coron' => ['Coron', 'luzon'],
        'puerto princesa' => ['Puerto Princesa', 'luzon'], 'el nido' => ['El Nido', 'luzon'], 'mindoro' => ['Mindoro', 'luzon'],
        'marinduque' => ['Marinduque', 'luzon'], 'romblon' => ['Romblon', 'luzon'], 'batanes' => ['Batanes', 'luzon'],
        'rizal' => ['Rizal', 'luzon'], 'metro manila' => ['Metro Manila', 'luzon'], 'fernando air base' => ['Lipa', 'luzon'],
        'basa air base' => ['Basa Air Base', 'luzon'], 'crow valley' => ['Crow Valley', 'luzon'],
    ];

    /** Philippine, but the headline doesn't say where. */
    private const PHILIPPINES = [
        'philippine', 'philippines', 'filipino', 'pinoy', 'ph', 'paf', 'caap', 'afp', 'pcg', 'pnp', 'pal',
        'cebu pacific', 'cebgo', 'airswift', 'airasia philippines', 'dotr', 'pagasa', 'ndrrmc', 'brawner',
    ];

    /** Same weather and similar operators: worth knowing when it's military or one of our types. */
    private const NEARBY = [
        'indonesia' => 'Indonesia', 'indonesian' => 'Indonesia', 'malaysia' => 'Malaysia', 'malaysian' => 'Malaysia',
        'sabah' => 'Sabah, Malaysia', 'sarawak' => 'Sarawak, Malaysia', 'borneo' => 'Borneo', 'brunei' => 'Brunei',
        'vietnam' => 'Vietnam', 'vietnamese' => 'Vietnam', 'thailand' => 'Thailand', 'thai' => 'Thailand',
        'singapore' => 'Singapore', 'taiwan' => 'Taiwan', 'papua' => 'Papua', 'timor' => 'Timor', 'cambodia' => 'Cambodia',
        'myanmar' => 'Myanmar', 'laos' => 'Laos',
    ];

    /** News words => one of the Wing's hazard categories (HazardClassifier handles the rest). */
    private const CATEGORY_HINTS = [
        'Weather' => ['weather', 'habagat', 'typhoon', 'storm', 'thunderstorm', 'lightning', 'monsoon', 'rains', 'fog', 'haze', 'wind shear', 'volcanic ash', 'ash cloud', 'eruption'],
        'Bird / wildlife strike' => ['bird', 'birds', 'wildlife'],
        'Engine / powerplant' => ['engine', 'power loss', 'generator'],
        'Landing gear / tire / brake' => ['gear-up', 'gear up', 'tyre', 'tire', 'landing gear', 'brake'],
        'Hard / precautionary landing' => ['emergency landing', 'forced landing', 'precautionary', 'runway excursion', 'overshot', 'overran', 'skidded', 'veered', 'hard landing', 'crash', 'crashed', 'crash-land', 'ditched'],
        'Fire' => ['fire', 'smoke', 'explosion'],
    ];

    /**
     * @return array{headline: string, kind: string, region: ?string, place: ?string, aircraft: ?string,
     *     fleet_type: ?string, military: bool, category: string}|null
     */
    public static function read(string $title, ?string $source = null): ?array
    {
        $headline = self::clean($title, $source);
        $text = ' '.mb_strtolower($headline).' ';

        if (! self::has($text, self::AVIATION) || self::has($text, self::EXCLUDE)) {
            return null;
        }

        $kind = null;
        foreach (self::KIND_RULES as $k => $words) {
            if (self::has($text, $words)) {
                $kind = $k;
                break;
            }
        }
        if (! $kind) {
            return null;
        }

        [$place, $region] = self::where($text);
        $fleet = self::firstKey($text, self::FLEET);
        $military = self::has($text, self::MILITARY);

        // Far away and not about our types or a military aircraft nearby: not ours to watch.
        if ($region === 'outside' && ! $fleet) {
            return null;
        }
        if ($region === 'nearby' && ! $fleet && ! $military && $kind !== 'accident') {
            return null;
        }

        return [
            'headline' => mb_substr($headline, 0, 300),
            'kind' => $kind,
            'region' => $region,
            'place' => $place,
            'aircraft' => $fleet ?? self::firstKey($text, self::OTHER_TYPES),
            'fleet_type' => $fleet,
            'military' => $military,
            'category' => self::category($text),
        ];
    }

    /** Official bodies a newsroom headline can quote ("PAF: …", "…, CAAP says", "… – Caap"). */
    private const OFFICIAL_VOICES = 'paf|caap|afp|dotr|dnd|pcg|ndrrmc|pagasa|philippine air force|philippine navy|philippine army|coast guard|ntsb|knkt';

    /**
     * Whether a headline reports an official body's own statement. A trusted
     * newsroom quoting the PAF or CAAP counts as an official source.
     */
    public static function quotesOfficial(string $headline): bool
    {
        $voices = self::OFFICIAL_VOICES;

        return (bool) preg_match("/^(?:{$voices})\\s*:|\\b(?:{$voices})\\s+(?:says|said|confirms|reports)\\b|\\b(?:says|said|confirms|per|according to)\\s+(?:the\\s+)?(?:{$voices})\\b|[\\-–—]\\s*(?:{$voices})\\s*$/iu", trim($headline));
    }

    /** Google News titles end in " - Source"; drop it. */
    public static function clean(string $title, ?string $source = null): string
    {
        $title = trim(html_entity_decode($title, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        if ($source && str_ends_with($title, ' - '.$source)) {
            return trim(mb_substr($title, 0, -mb_strlen(' - '.$source)));
        }

        return trim((string) preg_replace('/\s+-\s+[^-]{2,60}$/u', '', $title));
    }

    /**
     * Significant words for grouping articles about the same event.
     *
     * @return list<string>
     */
    public static function tokens(string $headline): array
    {
        static $stop = ['the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'and', 'or', 'after', 'with', 'from', 'by',
            'as', 'is', 'are', 'was', 'were', 'be', 'its', 'his', 'her', 'their', 'this', 'that', 'says', 'said', 'over',
            'into', 'amid', 'due', 'no', 'not', 'new', 'up', 'out', 'off', 'plane', 'aircraft', 'flight', 'flights',
            'helicopter', 'chopper', 'crash', 'crashes', 'crashed', 'incident', 'list', 'watch', 'video', 'news', 'update',
            'updates', 'live', 'what', 'we', 'know', 'how', 'why', 'who', 'ng', 'sa', 'mga', 'philippine', 'philippines'];
        preg_match_all('/[\p{L}\p{N}][\p{L}\p{N}\-]*/u', mb_strtolower($headline), $m);

        return array_values(array_unique(array_filter($m[0], fn ($w) => mb_strlen($w) > 2 && ! in_array($w, $stop, true))));
    }

    /** @return array{0: ?string, 1: string} [place, region] */
    private static function where(string $text): array
    {
        // Airline names aren't places: "Cebu Pacific flight at Butuan" happened in Butuan.
        $text = str_replace(['cebu pacific', 'cebgo', 'davao air'], ['cebupacific', 'cebgo', 'davaoair'], $text);
        $places = self::PLACES;
        uksort($places, fn ($a, $b) => mb_strlen($b) <=> mb_strlen($a));
        foreach ($places as $word => [$name, $region]) {
            if (self::has($text, [$word])) {
                return [$name, $region];
            }
        }
        foreach (self::NEARBY as $word => $name) {
            if (self::has($text, [$word])) {
                return [$name, 'nearby'];
            }
        }

        return self::has($text, self::PHILIPPINES) ? [null, 'philippines'] : [null, 'outside'];
    }

    private static function category(string $text): string
    {
        foreach (self::CATEGORY_HINTS as $label => $words) {
            if (self::has($text, $words)) {
                return $label;
            }
        }

        return HazardClassifier::primary($text);
    }

    /** @param  array<string, list<string>>  $map */
    private static function firstKey(string $text, array $map): ?string
    {
        foreach ($map as $key => $words) {
            if (self::has($text, $words)) {
                return $key;
            }
        }

        return null;
    }

    /** Whole-word (or whole-phrase) match, case already lowered. */
    private static function has(string $text, array $words): bool
    {
        foreach ($words as $w) {
            if (preg_match('/(?<![\p{L}\p{N}])'.preg_quote($w, '/').'(?![\p{L}\p{N}])/u', $text)) {
                return true;
            }
        }

        return false;
    }
}
