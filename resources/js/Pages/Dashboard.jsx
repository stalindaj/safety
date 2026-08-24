import { Head, Link } from '@inertiajs/react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import AppLayout from '@/Layouts/AppLayout';
import { Panel } from '@/Components/Ui';
import { AlertIcon, CheckIcon } from '@/Components/Icons';

const NAVY = '#1d4ed8'; // blue — lines & bars
const GOLD = '#eab308'; // yellow — monthly bars & highlight
const SKY = '#2563eb'; // Flight slice (blue)
const ROSE = '#f59e0b'; // Ground slice (amber/yellow)

const axis = { fontSize: 11, fontFamily: 'IBM Plex Mono, monospace', fill: '#64748b' };
const tooltipStyle = {
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    fontSize: 12,
    fontFamily: 'IBM Plex Mono, monospace',
    boxShadow: '0 4px 12px rgb(15 23 42 / 0.08)',
};

/* ── Plain-language finding row ──────────────────────────────────────────── */
const FINDING_TONE = {
    alert: { ring: 'ring-rose-200', bg: 'bg-rose-50', text: 'text-rose-900', icon: 'text-rose-500' },
    good: { ring: 'ring-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-900', icon: 'text-emerald-600' },
    info: { ring: 'ring-navy-200', bg: 'bg-navy-50', text: 'text-navy-900', icon: 'text-navy-500' },
};

function Finding({ text, tone }) {
    const t = FINDING_TONE[tone] ?? FINDING_TONE.info;
    const Icon = tone === 'good' ? CheckIcon : AlertIcon;

    return (
        <li className={`flex items-start gap-3 rounded-lg ${t.bg} px-4 py-3 ring-1 ring-inset ${t.ring}`}>
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${t.icon}`} />
            <p className={`text-sm leading-snug ${t.text}`}>{text}</p>
        </li>
    );
}

/* ── Comparison tile with trend arrow ───────────────────────────────────── */
function CompareTile({ label, value, sub, arrow }) {
    const arrowColor =
        arrow === 'up' ? 'text-rose-600' : arrow === 'down' ? 'text-emerald-600' : 'text-slate-400';
    const glyph = arrow === 'up' ? '▲' : arrow === 'down' ? '▼' : null;

    return (
        <div className="panel px-5 py-4">
            <p className="label-mono">{label}</p>
            <div className="mt-1.5 flex items-baseline gap-2">
                <span className="font-display text-3xl leading-none font-bold text-navy-800">{value}</span>
                {glyph && <span className={`text-sm font-bold ${arrowColor}`}>{glyph}</span>}
            </div>
            {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
        </div>
    );
}

/* ── Horizontal cause bar (no chart library — easier to scan) ────────────── */
function HazardBar({ label, count, pct, max, highlight }) {
    const width = max > 0 ? Math.max((count / max) * 100, 4) : 0;

    return (
        <div className="flex items-center gap-3 py-1.5">
            <span className="w-40 shrink-0 truncate text-sm text-navy-900" title={label}>
                {label}
            </span>
            <div className="h-6 flex-1 overflow-hidden rounded bg-slate-100">
                <div
                    className={`flex h-full items-center rounded ${highlight ? 'bg-gold-500' : 'bg-navy-700'}`}
                    style={{ width: `${width}%` }}
                />
            </div>
            <span className="w-24 shrink-0 text-right font-mono text-xs text-slate-600 tabular-nums">
                {count} · {pct}%
            </span>
        </div>
    );
}

export default function Dashboard({
    stats,
    comparison,
    findings,
    hazards,
    yearly_trend: yearlyTrend,
    environment_split: environmentSplit,
    monthly,
    monthly_year: monthlyYear,
    top_locations: topLocations,
}) {
    const maxHazard = hazards.reduce((m, h) => Math.max(m, h.count), 0);
    const compareArrow = comparison.direction; // up | down | same
    const deltaText =
        comparison.delta_pct === null
            ? `vs ${comparison.prev_count} last year`
            : `${comparison.delta_pct > 0 ? '+' : ''}${comparison.delta_pct}% vs ${comparison.prev_year}`;

    const flight = environmentSplit.find((e) => e.key === 'flight')?.value ?? 0;
    const ground = environmentSplit.find((e) => e.key === 'ground')?.value ?? 0;
    const envLead = flight >= ground ? 'Flight' : 'Ground';
    const envPct = stats.total ? Math.round((Math.max(flight, ground) / stats.total) * 100) : 0;

    return (
        <>
            <Head title="Safety Dashboard" />

            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="label-mono !text-gold-600">Wing Safety Overview</p>
                    <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-navy-900">
                        Safety Dashboard
                    </h1>
                    <p className="mt-1 text-sm text-slate-600">
                        {stats.total} mishaps on record, CY {stats.span}. Here's what the numbers say.
                    </p>
                </div>
                <Link
                    href="/mishaps"
                    className="label-mono !text-navy-700 hover:!text-navy-900 rounded-md bg-white px-3 py-2 ring-1 ring-slate-200 ring-inset transition hover:ring-navy-200"
                >
                    Go to Mishap Records &rarr;
                </Link>
            </div>

            {/* 1 — Plain-language findings, front and centre */}
            {findings.length > 0 && (
                <Panel title="Key Findings — In Plain Terms" className="mb-5">
                    <ul className="grid gap-2.5 md:grid-cols-2">
                        {findings.map((f, i) => (
                            <Finding key={i} text={f.text} tone={f.tone} />
                        ))}
                    </ul>
                </Panel>
            )}

            {/* 2 — This year vs last, as numbers not a chart */}
            <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <CompareTile
                    label={`This Year (${comparison.current_year})`}
                    value={comparison.current_count}
                    arrow={compareArrow}
                    sub={deltaText}
                />
                <CompareTile label={`Last Year (${comparison.prev_year})`} value={comparison.prev_count} />
                <CompareTile
                    label="Yearly Average"
                    value={comparison.avg_per_year}
                    sub={`across ${stats.span}`}
                />
                <CompareTile
                    label="Worst Year on Record"
                    value={comparison.peak_year ?? '—'}
                    sub={comparison.peak_year ? `${comparison.peak_count} mishaps` : null}
                />
            </div>

            {/* 3 — Top causes: the biggest new insight */}
            <div className="mb-5 grid gap-5 lg:grid-cols-5">
                <Panel title="Top Causes of Mishaps" className="lg:col-span-3">
                    <p className="label-mono mb-3 !text-[0.6rem]">
                        Grouped from each report's description · all years
                    </p>
                    {hazards.length === 0 ? (
                        <p className="py-8 text-center text-sm text-slate-500">No data yet.</p>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {hazards.map((h, i) => (
                                <HazardBar key={h.label} {...h} max={maxHazard} highlight={i === 0} />
                            ))}
                        </div>
                    )}
                </Panel>

                <Panel title="Where Mishaps Happen" className="lg:col-span-2">
                    <p className="label-mono mb-1 !text-[0.6rem]">Ground vs Flight · all years</p>
                    <p className="mb-2 text-sm text-slate-600">
                        <span className="font-semibold text-navy-800">{envLead} operations</span> account for{' '}
                        <span className="font-semibold text-navy-800">{envPct}%</span> of all mishaps.
                    </p>
                    <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={environmentSplit}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={78}
                                    label={(e) => `${e.name} ${e.value}`}
                                    labelLine={false}
                                    fontSize={11}
                                >
                                    {environmentSplit.map((entry) => (
                                        <Cell key={entry.key} fill={entry.key === 'flight' ? SKY : ROSE} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={tooltipStyle} />
                                <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'IBM Plex Mono, monospace' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Panel>
            </div>

            {/* 4 — Supporting detail charts, with a plain takeaway on each */}
            <p className="label-mono mb-3 !text-slate-400">Supporting Detail</p>
            <div className="grid gap-5 lg:grid-cols-3">
                <Panel title="Yearly Trend" className="lg:col-span-2">
                    <p className="mb-3 text-sm text-slate-600">
                        Mishaps per year across {stats.span}. Peak year:{' '}
                        <span className="font-semibold text-navy-800">
                            {comparison.peak_year} ({comparison.peak_count})
                        </span>
                        .
                    </p>
                    <div className="h-60">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={yearlyTrend} margin={{ top: 8, right: 16, bottom: 4, left: -16 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                                <XAxis dataKey="year" tick={axis} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                                <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
                                <Tooltip contentStyle={tooltipStyle} />
                                <Line
                                    type="monotone"
                                    dataKey="total"
                                    name="Mishaps"
                                    stroke={NAVY}
                                    strokeWidth={2.5}
                                    dot={{ r: 3, fill: NAVY }}
                                    activeDot={{ r: 5, fill: GOLD }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </Panel>

                <Panel title="Top 5 Locations">
                    <p className="mb-3 text-sm text-slate-600">Bases and areas with the most reports.</p>
                    <div className="h-60">
                        {topLocations.length === 0 ? (
                            <p className="pt-10 text-center text-sm text-slate-500">No data yet.</p>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={topLocations}
                                    layout="vertical"
                                    margin={{ top: 4, right: 20, bottom: 4, left: 8 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
                                    <XAxis type="number" tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
                                    <YAxis
                                        type="category"
                                        dataKey="location"
                                        tick={axis}
                                        tickLine={false}
                                        axisLine={{ stroke: '#e2e8f0' }}
                                        width={90}
                                    />
                                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }} />
                                    <Bar dataKey="total" name="Mishaps" fill={NAVY} radius={[0, 3, 3, 0]} maxBarSize={22} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </Panel>
            </div>

            <Panel title={`Monthly Pattern — ${monthlyYear}`} className="mt-5">
                <p className="mb-3 text-sm text-slate-600">
                    When mishaps occurred through the current year.
                </p>
                <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthly} margin={{ top: 8, right: 16, bottom: 4, left: -16 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                            <XAxis dataKey="month" tick={axis} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                            <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
                            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }} />
                            <Bar dataKey="total" name="Mishaps" fill={GOLD} radius={[3, 3, 0, 0]} maxBarSize={34} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Panel>
        </>
    );
}

Dashboard.layout = (page) => <AppLayout>{page}</AppLayout>;
