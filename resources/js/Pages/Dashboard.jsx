import { useMemo, useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import AppLayout from '@/Layouts/AppLayout';
import { Badge, Modal, Panel } from '@/Components/Ui';
import { AlertIcon, CheckIcon } from '@/Components/Icons';
import PhilippinesMap from '@/Components/PhilippinesMap';

// Chart colours are theme variables, so they follow light / dark mode.
const NAVY = 'var(--color-navy-600)';
const GOLD = 'var(--color-gold-500)';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const axis = { fontSize: 11, fontFamily: 'IBM Plex Mono, monospace', fill: 'var(--color-slate-500)' };
const tip = {
    borderRadius: 8, border: '1px solid var(--color-slate-200)', fontSize: 12,
    background: 'var(--color-white)', color: 'var(--color-navy-900)',
    fontFamily: 'IBM Plex Mono, monospace', boxShadow: '0 4px 12px rgb(15 23 42 / 0.08)',
};

/* ── small pieces ─────────────────────────────────────────────────────── */
function Kpi({ label, value, sub, accent }) {
    return (
        <div className="panel px-4 py-3">
            <p className={`font-display text-2xl leading-none font-bold ${accent ? 'text-gold-600' : 'text-navy-800'}`}>
                {value}
            </p>
            <p className="label-mono mt-1.5">{label}</p>
            {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
        </div>
    );
}

function Seg({ active, onClick, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-md px-3 py-1.5 font-mono text-[0.7rem] tracking-wide uppercase transition ${
                active ? 'bg-navy-800 text-white shadow-sm' : 'bg-white text-navy-700 ring-1 ring-slate-300 ring-inset hover:bg-slate-50'
            }`}
        >
            {children}
        </button>
    );
}

function HazardBar({ label, count, pct, max, highlight }) {
    const w = max > 0 ? Math.max((count / max) * 100, 4) : 0;
    return (
        <div className="flex items-center gap-3 py-1.5">
            <span className="w-40 shrink-0 truncate text-sm text-navy-900" title={label}>{label}</span>
            <div className="h-5 flex-1 overflow-hidden rounded bg-slate-100">
                <div className={`h-full rounded ${highlight ? 'bg-gold-500' : 'bg-navy-700'}`} style={{ width: `${w}%` }} />
            </div>
            <span className="w-20 shrink-0 text-right font-mono text-xs text-slate-600 tabular-nums">{count} · {pct}%</span>
        </div>
    );
}

const F_TONE = {
    alert: { ring: 'ring-rose-200', bg: 'bg-rose-50', text: 'text-rose-900', icon: 'text-rose-500' },
    good: { ring: 'ring-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-900', icon: 'text-emerald-600' },
    info: { ring: 'ring-navy-200', bg: 'bg-navy-50', text: 'text-navy-900', icon: 'text-navy-500' },
};
function Finding({ text, tone }) {
    const t = F_TONE[tone] ?? F_TONE.info;
    const Icon = tone === 'good' ? CheckIcon : AlertIcon;
    return (
        <li className={`flex items-start gap-3 rounded-lg ${t.bg} px-4 py-3 ring-1 ring-inset ${t.ring}`}>
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${t.icon}`} />
            <p className={`text-sm leading-snug ${t.text}`}>{text}</p>
        </li>
    );
}


function LocationDetail({ items }) {
    const n = items.length;
    const accidents = items.filter((i) => i.type === 'accident').length;
    const incidents = items.filter((i) => i.type === 'incident').length;
    const events = items.filter((i) => i.type === 'event').length;
    const flight = items.filter((i) => i.environment === 'flight').length;
    const Tile = ({ label, value }) => (
        <div className="rounded-md bg-slate-50 px-3 py-2 text-center ring-1 ring-slate-100 ring-inset">
            <p className="font-display text-xl font-bold text-navy-800">{value}</p>
            <p className="label-mono !text-[0.55rem]">{label}</p>
        </div>
    );
    return (
        <div>
            <div className="mb-4 grid grid-cols-5 gap-2">
                <Tile label="Total" value={n} />
                <Tile label="Accidents" value={accidents} />
                <Tile label="Incidents" value={incidents} />
                <Tile label="Events" value={events} />
                <Tile label="Flight / Ground" value={`${flight}/${n - flight}`} />
            </div>
            <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto pr-1">
                {items.map((it, i) => (
                    <li key={i} className="py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs text-navy-800">{it.display_date}</span>
                            <Badge tone={it.type === 'accident' ? 'red' : 'amber'}>{it.type}</Badge>
                            <Badge tone={it.environment === 'flight' ? 'sky' : 'navy'}>{it.environment}</Badge>
                            {it.category && <span className="label-mono !text-[0.6rem]">{it.category}</span>}
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{it.description}</p>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function BreakdownPanel({ title, items, unit = 'of the view' }) {
    if (!items.length) return null;
    const max = Math.max(...items.map((i) => i.count));
    const top = items[0];
    return (
        <Panel title={title}>
            <p className="mb-3 text-sm text-slate-600">
                <span className="font-semibold text-navy-900">{top.label}</span> leads — {top.count} {unit} ({top.pct}%).
            </p>
            <div className="divide-y divide-slate-100">
                {items.map((c) => <HazardBar key={c.label} {...c} max={max} highlight={false} />)}
            </div>
        </Panel>
    );
}

/* ── main ─────────────────────────────────────────────────────────────── */
export default function Dashboard({ records, current_year: currentYear, years, span }) {
    const [type, setType] = useState('all'); // all | accident | incident
    const [env, setEnv] = useState('all'); // all | ground | flight
    const [monthlyYear, setMonthlyYear] = useState(currentYear);
    const [mapYear, setMapYear] = useState('all');
    const [loc, setLoc] = useState(null);
    const [analysisScope, setAnalysisScope] = useState('all'); // all | month
    const [analysisMonth, setAnalysisMonth] = useState(''); // 'YYYY-M'

    const filtered = useMemo(
        () => records.filter((r) => (type === 'all' || r.type === type) && (env === 'all' || r.environment === env)),
        [records, type, env],
    );

    // headline counts for the segmented filter bar (from the full set)
    const bar = useMemo(() => ({
        total: records.length,
        accident: records.filter((r) => r.type === 'accident').length,
        incident: records.filter((r) => r.type === 'incident').length,
        event: records.filter((r) => r.type === 'event').length,
        ground: records.filter((r) => r.environment === 'ground').length,
        flight: records.filter((r) => r.environment === 'flight').length,
    }), [records]);

    const m = useMemo(() => {
        const total = filtered.length;
        const yr0 = years[0] ?? currentYear;
        const yr1 = years[years.length - 1] ?? currentYear;

        const groupCount = (arr, key) => {
            const map = {};
            for (const r of arr) { const k = key(r); if (k == null) continue; map[k] = (map[k] || 0) + 1; }
            return map;
        };
        const byYear = groupCount(filtered, (r) => r.year);
        const byYearFlight = groupCount(filtered.filter((r) => r.environment === 'flight'), (r) => r.year);
        const byYearGround = groupCount(filtered.filter((r) => r.environment === 'ground'), (r) => r.year);
        const yearlyTrend = [];
        for (let y = yr0; y <= yr1; y++) {
            yearlyTrend.push({ year: String(y), flight: byYearFlight[y] || 0, ground: byYearGround[y] || 0, total: byYear[y] || 0 });
        }
        const peakYear = Object.keys(byYear).sort((a, b) => byYear[b] - byYear[a])[0];

        const locCount = groupCount(filtered, (r) => r.location);
        const locations = Object.entries(locCount).map(([location, t]) => ({ location, total: t })).sort((a, b) => b.total - a.total);

        const categoryCount = groupCount(filtered, (r) => r.category || 'Other / mechanical');
        const categories = Object.entries(categoryCount).map(([label, count]) => ({ label, count, pct: total ? Math.round((count / total) * 100) : 0 })).sort((a, b) => b.count - a.count);

        const monthRows = filtered.filter((r) => r.year === Number(monthlyYear));
        const monthGround = groupCount(monthRows.filter((r) => r.environment === 'ground'), (r) => r.month);
        const monthFlight = groupCount(monthRows.filter((r) => r.environment === 'flight'), (r) => r.month);
        const monthly = MONTHS.map((mo, i) => ({ month: mo, flight: monthFlight[i + 1] || 0, ground: monthGround[i + 1] || 0 }));

        const accidents = filtered.filter((r) => r.type === 'accident').length;
        const incidents = filtered.filter((r) => r.type === 'incident').length;
        const events = filtered.filter((r) => r.type === 'event').length;
        const flight = filtered.filter((r) => r.environment === 'flight').length;
        const ground = total - flight;
        const thisYear = filtered.filter((r) => r.year === currentYear);
        const ytd = thisYear.length;
        const ytdFlight = thisYear.filter((r) => r.environment === 'flight').length;
        const ytdGround = ytd - ytdFlight;

        return {
            total, yearlyTrend, monthly, categories, locations, accidents, incidents, events, flight, ground, ytd, ytdFlight, ytdGround,
            topLocation: locations[0]?.location ?? '—',
            peakYear, peakCount: peakYear ? byYear[peakYear] : 0,
            avgPerYear: years.length ? Math.round((total / years.length) * 10) / 10 : 0,
            maxCategory: Math.max(0, ...categories.map((c) => c.count)),
            maxLoc: Math.max(0, ...locations.map((l) => l.total)),
            unlocated: filtered.filter((r) => !r.location).length,
        };
    }, [filtered, years, currentYear, monthlyYear]);

    // Months that actually have records, newest first (for the Monthly picker).
    const monthsAvail = useMemo(() => {
        const seen = new Map();
        for (const r of records) { const k = `${r.year}-${r.month}`; if (!seen.has(k)) seen.set(k, { year: r.year, month: r.month }); }
        return [...seen.values()].sort((a, b) => b.year - a.year || b.month - a.month);
    }, [records]);

    // Records feeding the analysis panels — all-time, or scoped to one month.
    const deepBase = useMemo(() => {
        if (analysisScope !== 'month' || !analysisMonth) return filtered;
        const [y, mo] = analysisMonth.split('-').map(Number);
        return filtered.filter((r) => r.year === y && r.month === mo);
    }, [filtered, analysisScope, analysisMonth]);

    // Deeper taxonomy breakdowns (respect the active filter + analysis scope).
    const deep = useMemo(() => {
        const grp = (arr, key) => {
            const map = {};
            for (const r of arr) { const k = key(r); if (!k) continue; map[k] = (map[k] || 0) + 1; }
            const t = Object.values(map).reduce((a, b) => a + b, 0);
            return Object.entries(map)
                .map(([label, count]) => ({ label, count, pct: t ? Math.round((count / t) * 100) : 0 }))
                .sort((a, b) => b.count - a.count);
        };
        const flight = deepBase.filter((r) => r.environment === 'flight');
        const ground = deepBase.filter((r) => r.environment === 'ground');
        // Rank: always list every group (EP/NCO/Officer/Civilian), even at 0.
        const RANK_ORDER = ['EP', 'NCO', 'Officer', 'Civilian'];
        const rankBase = grp(deepBase, (r) => r.rank_group);
        const present = new Set(rankBase.map((b) => b.label));
        const rank = [...rankBase, ...RANK_ORDER.filter((l) => !present.has(l)).map((label) => ({ label, count: 0, pct: 0 }))];
        return {
            aircraft: grp(flight, (r) => r.aircraft),
            phase: grp(flight, (r) => r.phase),
            vehicle: grp(ground, (r) => r.vehicle_type),
            rank,
            count: deepBase.length,
        };
    }, [deepBase]);

    // ── Slice C: year breakdown matrix (from ALL records) ──
    const breakdown = useMemo(() => {
        const rows = years.map((y) => {
            const yr = records.filter((r) => r.year === y);
            const c = (tp, en) => yr.filter((r) => r.type === tp && r.environment === en).length;
            return {
                year: y,
                ig: c('incident', 'ground'), if_: c('incident', 'flight'),
                ag: c('accident', 'ground'), af: c('accident', 'flight'),
                eg: c('event', 'ground'), ef: c('event', 'flight'),
                total: yr.length,
            };
        });
        const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
        return { rows, totals: { ig: sum('ig'), if_: sum('if_'), ag: sum('ag'), af: sum('af'), eg: sum('eg'), ef: sum('ef'), total: sum('total') } };
    }, [records, years]);

    // findings (respect the active filter; drop the ones the filter makes moot)
    const findings = useMemo(() => {
        const out = [];
        if (m.total === 0) return out;
        if (m.categories[0]) out.push({ text: `${m.categories[0].label} is the leading category — ${m.categories[0].count} of ${m.total} (${m.categories[0].pct}%).`, tone: 'alert' });
        if (env === 'all' && m.total) {
            const lead = m.flight >= m.ground ? 'Flight' : 'Ground';
            out.push({ text: `${lead} operations account for ${Math.round((Math.max(m.flight, m.ground) / m.total) * 100)}% of these mishaps (${Math.max(m.flight, m.ground)} of ${m.total}).`, tone: 'info' });
        }
        if (type === 'all' && m.total) {
            out.push({ text: `Most are minor: ${Math.round((m.incidents / m.total) * 100)}% incidents; ${m.accidents} accidents and ${m.events} events.`, tone: 'good' });
        }
        if (m.topLocation !== '—') {
            const n = m.locations[0].total;
            out.push({ text: `${m.topLocation} records the most — ${n} (${Math.round((n / m.total) * 100)}% of locations).`, tone: 'info' });
        }
        return out;
    }, [m, type, env]);

    const filterActive = type !== 'all' || env !== 'all';
    const scope = [type !== 'all' ? cap(type) + 's' : null, env !== 'all' ? cap(env) : null].filter(Boolean).join(' · ') || 'All mishaps';

    return (
        <>
            <Head title="Safety Dashboard" />

            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="label-mono !text-gold-600">Wing Safety Analytics</p>
                    <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-navy-900">Safety Dashboard</h1>
                    <p className="mt-1 text-sm text-slate-600">{records.length} mishaps on record, CY {span}.</p>
                </div>
                <Link href="/mishaps" className="label-mono !text-navy-700 hover:!text-navy-900 rounded-md bg-white px-3 py-2 ring-1 ring-slate-200 ring-inset transition hover:ring-navy-200">
                    Go to Mishap Records &rarr;
                </Link>
            </div>

            {/* Filter bar — click to cross-filter the whole dashboard */}
            <div className="panel mb-5 flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
                <div className="flex items-center gap-2">
                    <span className="label-mono">Type</span>
                    <Seg active={env === 'all'} onClick={() => setEnv('all')}>All {bar.total}</Seg>
                    <Seg active={env === 'ground'} onClick={() => setEnv('ground')}>Ground {bar.ground}</Seg>
                    <Seg active={env === 'flight'} onClick={() => setEnv('flight')}>Flight {bar.flight}</Seg>
                </div>
                <div className="flex items-center gap-2">
                    <span className="label-mono">Mishap</span>
                    <Seg active={type === 'all'} onClick={() => setType('all')}>All {bar.total}</Seg>
                    <Seg active={type === 'accident'} onClick={() => setType('accident')}>Accidents {bar.accident}</Seg>
                    <Seg active={type === 'incident'} onClick={() => setType('incident')}>Incidents {bar.incident}</Seg>
                    <Seg active={type === 'event'} onClick={() => setType('event')}>Events {bar.event}</Seg>
                </div>
                {filterActive && (
                    <button type="button" onClick={() => { setType('all'); setEnv('all'); }} className="label-mono !text-rose-500 hover:!text-rose-700">
                        Clear ✕
                    </button>
                )}
                <span className="label-mono ml-auto !text-navy-700">Showing: {scope} · {m.total}</span>
            </div>

            {/* KPI tiles */}
            <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
                <Kpi label="Mishaps (filtered)" value={m.total} sub={`of ${records.length} all-time`} />
                <Kpi label={`This Year (${currentYear})`} value={m.ytd} sub={`${m.ytdFlight} flight · ${m.ytdGround} ground`} accent />
                <Kpi label="Accidents (filtered)" value={m.accidents} sub={`${m.incidents} incidents · ${m.events} events`} />
                <Kpi label="Top Location" value={m.topLocation} />
                <Kpi label="Yearly Average" value={m.avgPerYear} sub={`peak ${m.peakYear ?? '—'} (${m.peakCount})`} />
            </div>


            {/* Key Findings */}
            {findings.length > 0 && (
                <Panel title="Key Findings — In Plain Terms" className="mb-5">
                    <ul className="grid gap-2.5 md:grid-cols-2">
                        {findings.map((f, i) => <Finding key={i} {...f} />)}
                    </ul>
                </Panel>
            )}

            {/* Causes + Map */}
            <div className="mb-5 grid gap-5 lg:grid-cols-5">
                <Panel title="Top Categories" className="lg:col-span-3">
                    <p className="label-mono mb-3 !text-[0.6rem]">Within current view · {scope}</p>
                    {m.categories.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No data.</p> : (
                        <div className="divide-y divide-slate-100">
                            {m.categories.map((c, i) => <HazardBar key={c.label} {...c} max={m.maxCategory} highlight={i === 0} />)}
                        </div>
                    )}
                </Panel>
                <Panel title="Where Mishaps Happen" className="lg:col-span-2">
                    <p className="label-mono mb-2 !text-[0.6rem]">Marker size = count · click for detail</p>
                    <PhilippinesMap locations={m.locations} unlocated={m.unlocated} onSelect={setLoc} />
                </Panel>
            </div>

            {/* Trend + Monthly (with year selector) */}
            <div className="mb-5 grid gap-5 lg:grid-cols-2">
                <Panel title="Yearly Trend">
                    <p className="mb-3 text-sm text-slate-600">Flight vs. ground mishaps per year · {scope}. Peak {m.peakYear ?? '—'} ({m.peakCount}).</p>
                    <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={m.yearlyTrend} margin={{ top: 8, right: 16, bottom: 4, left: -16 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-slate-200)" vertical={false} />
                                <XAxis dataKey="year" tick={axis} tickLine={false} axisLine={{ stroke: 'var(--color-slate-200)' }} />
                                <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
                                <Tooltip contentStyle={tip} />
                                <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' }} iconType="plainline" />
                                <Line type="monotone" dataKey="flight" name="Flight" stroke={NAVY} strokeWidth={2.5} dot={{ r: 3, fill: NAVY }} activeDot={{ r: 5 }} />
                                <Line type="monotone" dataKey="ground" name="Ground" stroke={GOLD} strokeWidth={2.5} dot={{ r: 3, fill: GOLD }} activeDot={{ r: 5 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </Panel>
                <Panel
                    title="Monthly Pattern"
                    action={
                        <select
                            className="field !w-auto !py-1 !text-xs"
                            value={monthlyYear}
                            onChange={(e) => setMonthlyYear(Number(e.target.value))}
                        >
                            {[...years].reverse().map((y) => <option key={y} value={y}>{y}</option>)}
                        </select>
                    }
                >
                    <p className="mb-3 text-sm text-slate-600">Flight vs. ground by month in {monthlyYear} · {scope}.</p>
                    <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={m.monthly} margin={{ top: 8, right: 16, bottom: 4, left: -16 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-slate-200)" vertical={false} />
                                <XAxis dataKey="month" tick={axis} tickLine={false} axisLine={{ stroke: 'var(--color-slate-200)' }} />
                                <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
                                <Tooltip contentStyle={tip} cursor={{ fill: 'var(--color-slate-100)' }} />
                                <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' }} />
                                <Bar dataKey="flight" name="Flight" fill={NAVY} radius={[3, 3, 0, 0]} maxBarSize={16} />
                                <Bar dataKey="ground" name="Ground" fill={GOLD} radius={[3, 3, 0, 0]} maxBarSize={16} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Panel>
            </div>

            {/* Deeper taxonomy analysis — fleet, phase, vehicle, rank */}
            <div className="panel mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <span className="label-mono">Analysis scope</span>
                <Seg active={analysisScope === 'all'} onClick={() => setAnalysisScope('all')}>All-time</Seg>
                <Seg
                    active={analysisScope === 'month'}
                    onClick={() => {
                        setAnalysisScope('month');
                        if (!analysisMonth && monthsAvail[0]) setAnalysisMonth(`${monthsAvail[0].year}-${monthsAvail[0].month}`);
                    }}
                >
                    Monthly
                </Seg>
                {analysisScope === 'month' && (
                    <select
                        className="field !w-auto !py-1 !text-xs"
                        value={analysisMonth}
                        onChange={(e) => setAnalysisMonth(e.target.value)}
                    >
                        {monthsAvail.map((mo) => (
                            <option key={`${mo.year}-${mo.month}`} value={`${mo.year}-${mo.month}`}>
                                {MONTHS[mo.month - 1]} {mo.year}
                            </option>
                        ))}
                    </select>
                )}
                <span className="label-mono ml-auto !text-navy-700">{deep.count} record{deep.count === 1 ? '' : 's'} in scope</span>
            </div>

            {deep.count === 0 ? (
                <Panel className="mb-5">
                    <p className="py-6 text-center text-sm text-slate-500">No records in this month for the current filter.</p>
                </Panel>
            ) : (
                <div className="mb-5 grid gap-5 lg:grid-cols-2">
                    <BreakdownPanel title="By Aircraft — Flight" items={deep.aircraft} unit="flight mishaps" />
                    <BreakdownPanel title="By Phase of Flight" items={deep.phase} unit="flight mishaps" />
                    <BreakdownPanel title="By Vehicle Type — Ground" items={deep.vehicle} unit="ground mishaps" />
                    <BreakdownPanel title="Personnel Rank Involved" items={deep.rank} unit="records" />
                </div>
            )}


            {/* Slice C — year breakdown matrix */}
            <Panel title={`Breakdown of Mishaps — CY ${span}`}>
                <p className="label-mono mb-3 !text-[0.6rem]">All records · incidents, accidents & events by environment</p>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 text-left">
                                <th rowSpan={2} className="label-mono px-3 py-2 align-bottom">Year</th>
                                <th colSpan={2} className="label-mono border-l border-slate-100 px-3 py-1.5 text-center">Incidents</th>
                                <th colSpan={2} className="label-mono border-l border-slate-100 px-3 py-1.5 text-center">Accidents</th>
                                <th colSpan={2} className="label-mono border-l border-slate-100 px-3 py-1.5 text-center">Events</th>
                                <th rowSpan={2} className="label-mono border-l border-slate-100 px-3 py-2 text-right align-bottom">Total</th>
                            </tr>
                            <tr className="border-b border-slate-200 text-left">
                                <th className="label-mono border-l border-slate-100 px-3 py-1.5 !text-[0.6rem]">Ground</th>
                                <th className="label-mono px-3 py-1.5 !text-[0.6rem]">Flight</th>
                                <th className="label-mono border-l border-slate-100 px-3 py-1.5 !text-[0.6rem]">Ground</th>
                                <th className="label-mono px-3 py-1.5 !text-[0.6rem]">Flight</th>
                                <th className="label-mono border-l border-slate-100 px-3 py-1.5 !text-[0.6rem]">Ground</th>
                                <th className="label-mono px-3 py-1.5 !text-[0.6rem]">Flight</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {breakdown.rows.map((r) => (
                                <tr key={r.year} className="hover:bg-slate-50">
                                    <td className="px-3 py-2 font-mono text-navy-800">{r.year}</td>
                                    <td className="border-l border-slate-100 px-3 py-2 font-mono tabular-nums text-slate-600">{r.ig}</td>
                                    <td className="px-3 py-2 font-mono tabular-nums text-slate-600">{r.if_}</td>
                                    <td className="border-l border-slate-100 px-3 py-2 font-mono tabular-nums text-rose-600">{r.ag}</td>
                                    <td className="px-3 py-2 font-mono tabular-nums text-rose-600">{r.af}</td>
                                    <td className="border-l border-slate-100 px-3 py-2 font-mono tabular-nums text-slate-600">{r.eg}</td>
                                    <td className="px-3 py-2 font-mono tabular-nums text-slate-600">{r.ef}</td>
                                    <td className="border-l border-slate-100 px-3 py-2 text-right font-mono font-semibold tabular-nums text-navy-900">{r.total}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="border-t-2 border-navy-200 bg-navy-50/50 font-semibold">
                                <td className="px-3 py-2 font-mono text-navy-900">Total</td>
                                <td className="border-l border-slate-100 px-3 py-2 font-mono tabular-nums text-navy-900">{breakdown.totals.ig}</td>
                                <td className="px-3 py-2 font-mono tabular-nums text-navy-900">{breakdown.totals.if_}</td>
                                <td className="border-l border-slate-100 px-3 py-2 font-mono tabular-nums text-navy-900">{breakdown.totals.ag}</td>
                                <td className="px-3 py-2 font-mono tabular-nums text-navy-900">{breakdown.totals.af}</td>
                                <td className="border-l border-slate-100 px-3 py-2 font-mono tabular-nums text-navy-900">{breakdown.totals.eg}</td>
                                <td className="px-3 py-2 font-mono tabular-nums text-navy-900">{breakdown.totals.ef}</td>
                                <td className="border-l border-slate-100 px-3 py-2 text-right font-mono tabular-nums text-navy-900">{breakdown.totals.total}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </Panel>

            <Modal open={loc !== null} onClose={() => setLoc(null)} title={loc ? `${loc} — Mishap Details` : ''}>
                {loc && <LocationDetail items={filtered.filter((r) => r.location === loc)} />}
            </Modal>
        </>
    );
}

Dashboard.layout = (page) => <AppLayout>{page}</AppLayout>;
