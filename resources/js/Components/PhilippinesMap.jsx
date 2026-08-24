import { useState } from 'react';

/**
 * Self-contained Philippines map (no external tiles). The outline is a
 * simplified public-domain Natural Earth country boundary, projected
 * equirectangularly into the viewBox below. Mishap locations are plotted with
 * the SAME projection so the markers line up with the coast; marker AREA is
 * proportional to the mishap count.
 */

const PH_PATH =
    'M489.1,563.0 L494.2,596.4 L497.1,624.6 L480.2,670.7 L462.1,619.4 L439.0,644.9 L454.8,682.0 L440.6,705.6 L382.3,676.4 L368.4,640.0 L383.5,616.0 L352.1,592.2 L336.6,613.1 L313.3,611.2 L276.6,639.2 L268.4,624.5 L287.9,582.1 L319.1,567.9 L346.1,549.0 L363.6,571.7 L401.2,558.0 L409.3,535.5 L444.3,534.2 L441.4,495.2 L481.5,519.1 L485.7,544.5 L489.1,563.0Z M370.6,469.1 L352.8,485.7 L337.3,517.5 L321.7,532.4 L291.2,497.6 L301.4,484.1 L313.8,470.0 L319.3,438.8 L346.6,435.8 L338.6,469.7 L375.3,421.1 L370.6,469.1Z M99.3,517.6 L33.4,565.3 L57.7,530.1 L93.4,499.1 L123.2,464.2 L149.1,414.2 L158.0,455.3 L125.3,483.0 L99.3,517.6Z M266.6,388.0 L296.3,403.5 L327.9,403.5 L326.9,424.5 L304.0,445.9 L272.5,461.0 L270.8,437.6 L274.3,411.9 L266.6,388.0Z M445.8,374.3 L459.8,430.5 L421.5,417.2 L422.6,434.1 L434.7,465.1 L411.1,476.4 L409.1,441.0 L394.2,438.4 L386.4,407.9 L415.6,411.9 L414.9,392.9 L384.6,354.4 L432.2,355.6 L445.8,374.3Z M249.0,328.7 L235.8,372.2 L214.6,347.1 L189.4,308.7 L231.8,310.6 L249.0,328.7Z M238.8,55.2 L269.3,69.5 L284.6,56.4 L289.1,69.2 L281.0,90.1 L297.9,126.2 L284.9,168.0 L255.7,184.7 L247.9,225.2 L259.0,265.3 L285.2,270.9 L307.1,264.9 L369.0,292.8 L364.3,320.2 L380.4,332.3 L375.3,355.5 L336.7,330.8 L318.4,304.4 L305.6,322.8 L274.1,292.7 L229.1,300.1 L204.5,289.0 L207.0,268.2 L222.5,255.4 L207.7,243.8 L201.3,261.9 L176.8,233.0 L169.4,211.1 L167.6,162.9 L187.5,179.4 L192.6,100.7 L208.8,55.1 L238.8,55.2Z';

const VB = { w: 520, h: 760, lon0: 116.5, lon1: 127.0, lat0: 4.5, lat1: 19.6 };

const project = (lat, lng) => ({
    x: ((lng - VB.lon0) / (VB.lon1 - VB.lon0)) * VB.w,
    y: ((VB.lat1 - lat) / (VB.lat1 - VB.lat0)) * VB.h,
});

// Approximate [lat, lng] for each location string in the record. Bases are
// placed at their real airfield; TOG entries at their tactical operations
// group's home station.
const GEOCODE = {
    MDAAB: [14.495, 120.905],
    'TOG 9': [6.92, 122.06],
    EAAB: [6.922, 122.059],
    'Cavite City': [14.483, 120.897],
    'TOG 10': [8.42, 124.61],
    LAB: [8.415, 124.611],
    Lumbia: [8.415, 124.611],
    'Cagayan De Oro': [8.482, 124.647],
    'TOG 8': [11.228, 125.028],
    'TOG 12': [7.1, 124.3],
    'TOG 5': [13.157, 123.735],
    'Pasay City': [14.538, 120.997],
    'Macapagal Blvd': [14.53, 120.98],
    'Kawit, Cavite': [14.444, 120.905],
    'Tanza, Cavite': [14.394, 120.851],
    'Gen Trias, Cavite': [14.386, 120.881],
    'Centennial Road, Cavite': [14.45, 120.9],
    CVGR: [15.37, 120.42],
    CAB: [15.186, 120.56],
    FAB: [13.955, 121.125],
    'Pilar, Bataan': [14.66, 120.57],
    'Marilao, Bulacan': [14.758, 120.948],
    'San Juan, Batangas': [13.826, 121.396],
    'Talisay-Tanauan Road, Tanuan City Batangas': [14.08, 121.15],
    'Tagatay-Calamba Road': [14.2, 121.1],
    'San Fernando Airport, La Union': [16.596, 120.303],
    'Zamboanga Del Norte': [8.5, 123.3],
    'Malabaybay City, Bukidnon': [8.157, 125.128],
    Bukidnon: [8.05, 125.1],
    'KHTB, Jolo': [6.053, 121.002],
    'Getafe, Bohol': [10.15, 124.15],
    'Davao De Oro': [7.55, 126.05],
    Butuan: [8.949, 125.54],
};

const radius = (count) => 3 + Math.sqrt(count) * 2.4;

export default function PhilippinesMap({ locations = [], unlocated = 0, onSelect }) {
    const [hover, setHover] = useState(null);

    const placed = locations
        .filter((l) => GEOCODE[l.location])
        .map((l) => {
            const [lat, lng] = GEOCODE[l.location];
            return { ...l, ...project(lat, lng) };
        })
        .sort((a, b) => b.total - a.total); // biggest first → drawn underneath

    const offMap =
        locations.filter((l) => !GEOCODE[l.location]).reduce((s, l) => s + l.total, 0) + unlocated;

    return (
        <div className="relative">
            <svg
                viewBox={`0 0 ${VB.w} ${VB.h}`}
                className="mx-auto block h-auto w-full max-w-[380px]"
                role="img"
                aria-label="Map of mishap locations across the Philippines"
            >
                <path d={PH_PATH} fill="#eaf0f7" stroke="#bcd0e6" strokeWidth="1.2" />
                {placed.map((l, i) => {
                    const top = i === 0;
                    return (
                        <g
                            key={l.location}
                            onMouseEnter={() => setHover(l)}
                            onMouseLeave={() => setHover(null)}
                            onClick={() => onSelect?.(l.location)}
                            style={{ cursor: onSelect ? 'pointer' : 'default' }}
                        >
                            <circle
                                cx={l.x}
                                cy={l.y}
                                r={radius(l.total)}
                                fill={top ? '#eab308' : '#2563eb'}
                                fillOpacity="0.55"
                                stroke={top ? '#a16207' : '#1e40af'}
                                strokeWidth="1"
                            />
                            {l.total >= 5 && (
                                <text
                                    x={l.x}
                                    y={l.y}
                                    textAnchor="middle"
                                    dominantBaseline="central"
                                    fontSize="10"
                                    fontFamily="IBM Plex Mono, monospace"
                                    fontWeight="700"
                                    fill="#fff"
                                >
                                    {l.total}
                                </text>
                            )}
                            <title>{`${l.location}: ${l.total}`}</title>
                        </g>
                    );
                })}
            </svg>

            {hover && (
                <div className="pointer-events-none absolute left-2 top-2 rounded-md bg-navy-900 px-2.5 py-1 font-mono text-xs text-white shadow">
                    {hover.location} · {hover.total}
                </div>
            )}

            {offMap > 0 && (
                <p className="label-mono mt-1 text-center !text-[0.6rem]">
                    {offMap} at unspecified / off-map location{offMap === 1 ? '' : 's'}
                </p>
            )}
        </div>
    );
}
