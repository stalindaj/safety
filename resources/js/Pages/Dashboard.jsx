import { useMemo, useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ReferenceLine,
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
const dayIdx = (m, d) => Math.floor(Date.UTC(2001, m - 1, d) / 86400000); // day-of-year, year-agnostic
const mondayOf = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // back up to Monday
    return d.toISOString().slice(0, 10);
};
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

// A single contributing-factor bar for the forecast (width = relative impact).
const FBAR_FILL = { alert: 'bg-rose-500', info: 'bg-navy-600', good: 'bg-emerald-500' };
function FactorBar({ text, impact, tone }) {
    if (!impact) return <p className="py-1.5 text-sm text-emerald-700">{text}</p>;
    return (
        <div className="flex items-center gap-3 py-1.5">
            <span className="w-56 shrink-0 text-sm text-navy-900">{text}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded bg-slate-100">
                <div className={`h-full rounded ${FBAR_FILL[tone] ?? FBAR_FILL.info}`} style={{ width: `${Math.max(impact, 6)}%` }} />
            </div>
        </div>
    );
}

const TYPE_TONE = { accident: 'red', incident: 'amber', event: 'neutral' };
const ENV_TONE = { flight: 'sky', ground: 'navy' };

// Plain-language risk bands for the weekly forecast (worst → best).
const RISK_BAND = {
    // Default: the honest historical rate. Week-to-week prediction was retired
    // after walk-forward validation showed no feature set beat the base rate.
    baseline: { label: 'Base rate', dot: '', tile: 'bg-navy-50 ring-navy-100', text: 'text-navy-800' },
    high: { label: 'High', dot: '🔴', tile: 'bg-rose-50 ring-rose-100', text: 'text-rose-700' },
    elevated: { label: 'Elevated', dot: '🟠', tile: 'bg-orange-50 ring-orange-100', text: 'text-orange-700' },
    moderate: { label: 'Moderate', dot: '🟡', tile: 'bg-amber-50 ring-amber-100', text: 'text-amber-700' },
    low: { label: 'Low', dot: '🟢', tile: 'bg-emerald-50 ring-emerald-100', text: 'text-emerald-700' },
};
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

/* Safety Performance Indicator — ICAO Doc 9859 §4.4.5 style trigger levels.
   Detects an abnormal rate; it does not predict individual events. */
const SPI_STATUS = {
    normal: { label: 'Normal', tile: 'bg-emerald-50 ring-emerald-100', text: 'text-emerald-700' },
    caution: { label: 'Caution', tile: 'bg-amber-50 ring-amber-100', text: 'text-amber-700' },
    alert: { label: 'Alert', tile: 'bg-orange-50 ring-orange-100', text: 'text-orange-700' },
    critical: { label: 'Critical', tile: 'bg-rose-50 ring-rose-100', text: 'text-rose-700' },
};
function SpiPanel({ spi }) {
    if (!spi || !spi.series?.length) return null;
    const st = SPI_STATUS[spi.status] ?? SPI_STATUS.normal;
    const L = spi.levels;
    return (
        <Panel title={`Safety Performance Indicator — rolling ${spi.window_days}-day mishap count`} className="mb-5">
            <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
                <div className={`self-start rounded-lg p-4 text-center ring-1 ring-inset ${st.tile}`}>
                    <p className="label-mono !text-[0.6rem]">Current status</p>
                    <p className={`font-display mt-1 text-3xl font-bold ${st.text}`}>{st.label}</p>
                    <p className="mt-1 text-xs text-slate-600">
                        {spi.current} mishap{spi.current === 1 ? '' : 's'} in the last {spi.window_days} days
                    </p>
                    <div className="mt-3 space-y-0.5 border-t border-white/60 pt-2 text-left font-mono text-[0.65rem] text-slate-600">
                        <p>normal (mean) · {L.mean}</p>
                        <p>caution +1σ · {L.caution}</p>
                        <p className="text-orange-700">alert +2σ · {L.alert}</p>
                        <p className="text-rose-700">critical +3σ · {L.critical}</p>
                    </div>
                </div>

                <div className="min-w-0">
                    <p className="mb-2 text-sm text-slate-600">
                        Trigger levels are the historical mean ({spi.mean}) plus multiples of the standard
                        deviation ({spi.sd}) — the method ICAO prescribes for safety triggers.
                    </p>
                    <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={spi.series} margin={{ top: 8, right: 16, bottom: 4, left: -20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-slate-200)" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    tick={axis}
                                    tickLine={false}
                                    axisLine={{ stroke: 'var(--color-slate-200)' }}
                                    interval={Math.ceil(spi.series.length / 8)}
                                    tickFormatter={(d) => String(d).slice(0, 7)}
                                />
                                <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                                <Tooltip contentStyle={tip} formatter={(v) => [`${v} mishaps`, `${spi.window_days}-day count`]} />
                                <ReferenceLine y={L.mean} stroke="var(--color-slate-400)" strokeDasharray="4 4" />
                                <ReferenceLine y={L.alert} stroke="#ea7317" strokeDasharray="6 3" />
                                <ReferenceLine y={L.critical} stroke="#e11d48" strokeDasharray="6 3" />
                                <Line type="monotone" dataKey="value" stroke={NAVY} strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {spi.breaches?.length > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-3">
                    <p className="label-mono mb-2 !text-[0.6rem]">Periods that breached the alert level</p>
                    <ul className="flex flex-wrap gap-2">
                        {spi.breaches.map((b, i) => (
                            <li key={i} className="rounded-md bg-orange-50 px-2.5 py-1 text-xs text-orange-900 ring-1 ring-orange-200 ring-inset">
                                {b.from} → {b.to} · peak {b.peak}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <p className="label-mono mt-3 !text-[0.55rem] !text-slate-400">
                Method: ICAO Doc 9859 (SMM 4th ed) §4.4.5 — trigger levels from the population standard
                deviation of preceding data points. Detects abnormal rates; does not predict individual events.
            </p>
        </Panel>
    );
}

/* A titled list of proportional bars with an auto-generated insight line. */
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

/* CAPS follow-through: the chosen year's mishaps with their corrective-action
   progress, then the same actions rolled up by the unit (OPR/UPR) that owns them.
   "Open" = anything not yet Complied. */
const CAP_ORDER = ['complied', 'approved', 'as_required', 'ongoing', 'pending'];
const CAP_LABEL = { complied: 'Complied', approved: 'Approved', as_required: 'As required', ongoing: 'Ongoing', pending: 'Pending' };
const CAP_FILL = { complied: 'bg-emerald-500', approved: 'bg-navy-500', as_required: 'bg-slate-400', ongoing: 'bg-sky-500', pending: 'bg-amber-400' };

function tallyCaps(actions) {
    const by = Object.fromEntries(CAP_ORDER.map((s) => [s, 0]));
    actions.forEach((a) => { by[a.status] = (by[a.status] ?? 0) + 1; });
    return {
        by,
        total: actions.length,
        complied: by.complied,
        open: actions.length - by.complied,
        noProof: actions.filter((a) => a.status === 'complied' && !a.proof).length,
    };
}

function CapsBar({ t }) {
    const summary = CAP_ORDER.filter((s) => t.by[s]).map((s) => `${t.by[s]} ${CAP_LABEL[s]}`).join(' · ');
    return (
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100" title={summary} aria-label={summary}>
            {CAP_ORDER.map((s) => t.by[s] > 0 && (
                <div key={s} className={CAP_FILL[s]} style={{ width: `${(t.by[s] / t.total) * 100}%` }} />
            ))}
        </div>
    );
}

function CapsOverview({ mishaps, currentYear }) {
    const years = useMemo(() => [...new Set(mishaps.map((m) => m.year))].sort((a, b) => b - a), [mishaps]);
    const [year, setYear] = useState(years.includes(currentYear) ? currentYear : years[0]);
    if (!mishaps.length) return null;

    const list = mishaps.filter((m) => m.year === year);
    const actions = list.flatMap((m) => m.actions);
    const all = tallyCaps(actions);
    const waiting = list.filter((m) => m.actions.length === 0).length;
    const units = Object.values(actions.reduce((acc, a) => {
        const key = a.unit ?? 'Unassigned';
        (acc[key] ??= { unit: key, actions: [] }).actions.push(a);
        return acc;
    }, {}))
        .map((u) => ({
            unit: u.unit,
            t: tallyCaps(u.actions),
            followUps: [...new Set(u.actions.filter((a) => a.status !== 'complied' && a.follow_up).map((a) => a.follow_up))],
        }))
        .sort((a, b) => b.t.open - a.t.open || b.t.total - a.t.total);

    return (
        <Panel
            title={`Corrective Actions (CAPS) — CY ${year} Mishaps`}
            className="mb-5"
            action={
                <select className="field !w-auto !py-1 font-mono text-xs" value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Year">
                    {years.map((y) => <option key={y} value={y}>CY {y}</option>)}
                </select>
            }
        >
            <p className="mb-3 text-sm text-slate-600">
                {list.length} mishap{list.length === 1 ? '' : 's'} in {year} · {all.total} corrective action{all.total === 1 ? '' : 's'}
                {all.total > 0 && (
                    <>
                        {' — '}
                        <span className="font-semibold text-navy-900">{Math.round((all.complied / all.total) * 100)}% complied</span>
                        {all.open > 0 && `, ${all.open} still open`}
                    </>
                )}
                {waiting > 0 && ` · ${waiting} awaiting recommendations`}.
            </p>
            <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1">
                {CAP_ORDER.map((s) => (
                    <span key={s} className="flex items-center gap-1.5 text-[0.7rem] text-slate-500">
                        <span className={`h-2 w-2 rounded-sm ${CAP_FILL[s]}`} />{CAP_LABEL[s]}
                    </span>
                ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                <div>
                    <p className="label-mono mb-1 !text-[0.6rem]">Mishaps and their CAPS</p>
                    <ul className="divide-y divide-slate-100">
                        {list.map((m) => {
                            const t = tallyCaps(m.actions);
                            return (
                                <li key={m.id} className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_13rem]">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-mono text-xs text-navy-800">{m.display_date}</span>
                                            <span className="text-sm font-medium text-navy-900">{m.location ?? '—'}</span>
                                            <Badge tone={TYPE_TONE[m.type]}>{m.type}</Badge>
                                            <Badge tone={ENV_TONE[m.environment]}>{m.environment}</Badge>
                                        </div>
                                        <p className="mt-1 line-clamp-2 text-xs text-slate-600" title={m.description}>{m.description}</p>
                                    </div>
                                    <div>
                                        {t.total === 0 ? (
                                            <>
                                                <Badge tone="neutral">No CAPS yet</Badge>
                                                <p className="mt-1 text-[0.7rem] text-slate-500">Awaiting the board's recommendations</p>
                                            </>
                                        ) : (
                                            <>
                                                <CapsBar t={t} />
                                                <p className="mt-1.5 text-xs text-slate-600">
                                                    <span className="font-semibold text-navy-900">{t.complied} of {t.total}</span> complied
                                                    {t.open > 0 ? ` · ${t.open} open` : ' · all done'}
                                                </p>
                                                {t.noProof > 0 && (
                                                    <p className="text-[0.7rem] text-amber-700">{t.noProof} complied without proof</p>
                                                )}
                                            </>
                                        )}
                                        <Link href={`/mishaps/${m.id}/plan`} className="label-mono mt-1.5 inline-block !text-gold-700 hover:!text-gold-800">
                                            {t.total ? 'Open CAPS →' : 'Add CAPS →'}
                                        </Link>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>

                <div>
                    <p className="label-mono mb-1 !text-[0.6rem]">By squadron / unit (OPR / UPR)</p>
                    {units.length === 0 ? (
                        <p className="py-3 text-sm text-slate-500">No corrective actions for {year} yet.</p>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {units.map((u) => (
                                <li key={u.unit} className="py-2.5">
                                    <div className="flex items-baseline justify-between gap-3">
                                        <span className="text-sm font-medium text-navy-900">{u.unit}</span>
                                        <span className="shrink-0 font-mono text-xs text-slate-500">
                                            {u.t.complied}/{u.t.total} complied{u.t.open > 0 ? ` · ${u.t.open} open` : ''}
                                        </span>
                                    </div>
                                    <div className="mt-1.5"><CapsBar t={u.t} /></div>
                                    {u.followUps.length > 0 && (
                                        <p className="mt-1 text-[0.7rem] text-slate-500">Follow-up: {u.followUps.join(', ')}</p>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </Panel>
    );
}

/* ── main ─────────────────────────────────────────────────────────────── */
export default function Dashboard({ records, current_year: currentYear, years, span, today, risk_forecasts: riskForecasts = [], caps = [], spi = null }) {
    const [type, setType] = useState('all'); // all | accident | incident
    const [env, setEnv] = useState('all'); // all | ground | flight
    const [monthlyYear, setMonthlyYear] = useState(currentYear);
    const [mapYear, setMapYear] = useState('all');
    const [loc, setLoc] = useState(null);
    const [weekIdx, setWeekIdx] = useState(-1); // -1 = default to the week containing today
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

    // ── Slice B: Safety Forecast for the viewed week (from ALL records) ──
    // Precomputed model rows keyed by week-start, plus a client-side summary of
    // the mishaps that historically fall in that calendar week.
    const forecastMap = useMemo(
        () => Object.fromEntries(riskForecasts.map((f) => [f.week_start, f])),
        [riskForecasts],
    );
    // Navigate among the weeks the model actually produced, so the viewed week
    // always has a forecast (and its factor bars) rather than falling back.
    const weeks = useMemo(() => riskForecasts.map((f) => f.week_start).sort(), [riskForecasts]);
    const defaultIdx = useMemo(() => {
        if (!weeks.length) return 0;
        const after = weeks.findIndex((w) => w > today);
        return after === -1 ? weeks.length - 1 : Math.max(0, after - 1);
    }, [weeks, today]);
    const idx = weekIdx < 0 ? defaultIdx : Math.min(Math.max(weekIdx, 0), Math.max(weeks.length - 1, 0));
    const weekStart = weeks.length ? weeks[idx] : mondayOf(today);
    const riskForecast = forecastMap[weekStart] ?? null;

    const weekInfo = useMemo(() => {
        const t = new Date(weekStart + 'T00:00:00');
        const start = dayIdx(t.getMonth() + 1, t.getDate());
        const inWeek = (r) => (((dayIdx(r.month, r.day) - start) % 365) + 365) % 365 <= 6;
        const week = records.filter(inWeek).sort((a, b) => (a.month - b.month) || (a.day - b.day));
        const distinctYears = new Set(week.map((r) => r.year)).size;
        const end = new Date(t.getTime() + 6 * 86400000);
        const fmt = (d) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
        return {
            week,
            flight: week.filter((r) => r.environment === 'flight').length,
            ground: week.filter((r) => r.environment === 'ground').length,
            likelihood: years.length ? Math.round((distinctYears / years.length) * 100) : 0,
            distinctYears,
            label: `${fmt(t)} – ${fmt(end)}`,
        };
    }, [records, weekStart, years]);

    const shiftIdx = (delta) => setWeekIdx(Math.min(Math.max(idx + delta, 0), weeks.length - 1));

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

            {/* Slice B — Safety Forecast (week-changer + risk-across-year chart) */}
            <Panel
                title="Safety Forecast"
                className="mb-5"
                action={
                    <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => shiftIdx(-1)} disabled={idx <= 0} title="Previous week"
                            className="rounded-md px-2 py-1 font-mono text-xs text-navy-700 ring-1 ring-slate-300 ring-inset hover:bg-slate-50 disabled:opacity-30">◀</button>
                        <span className="label-mono !text-navy-800 min-w-32 text-center">{weekInfo.label}</span>
                        <button type="button" onClick={() => shiftIdx(1)} disabled={idx >= weeks.length - 1} title="Next week"
                            className="rounded-md px-2 py-1 font-mono text-xs text-navy-700 ring-1 ring-slate-300 ring-inset hover:bg-slate-50 disabled:opacity-30">▶</button>
                        {idx !== defaultIdx && (
                            <button type="button" onClick={() => setWeekIdx(-1)}
                                className="label-mono !text-gold-700 hover:!text-gold-800 ml-1">This week</button>
                        )}
                    </div>
                }
            >
                {(() => {
                    const band = riskForecast ? (RISK_BAND[riskForecast.risk_level] ?? RISK_BAND.moderate) : null;
                    return (
                        <>
                        <div className="grid items-start gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
                            {band ? (
                                <div className={`rounded-lg p-4 text-center ring-1 ring-inset ${band.tile}`}>
                                    <p className="label-mono !text-[0.6rem]">
                                        {riskForecast.risk_level === 'baseline' ? 'Weekly base rate' : 'Risk this week'}
                                    </p>
                                    {riskForecast.risk_level === 'baseline' ? (
                                        <>
                                            <p className={`font-display mt-1 text-4xl font-bold ${band.text}`}>
                                                {riskForecast.likelihood}%
                                            </p>
                                            <p className="mt-1 text-xs text-slate-500">of weeks have a flight mishap</p>
                                        </>
                                    ) : (
                                        <>
                                            <p className={`font-display mt-1 text-3xl font-bold ${band.text}`}>{band.dot} {band.label}</p>
                                            {riskForecast.likelihood != null && (
                                                <p className="mt-1 text-xs text-slate-500">
                                                    ~{riskForecast.likelihood}% this week
                                                    {riskForecast.baseline != null && ` · normal ~${riskForecast.baseline}%`}
                                                </p>
                                            )}
                                        </>
                                    )}
                                    <p className="mt-1 text-xs text-slate-500">
                                        {weekInfo.week.length} mishap{weekInfo.week.length === 1 ? '' : 's'} in {weekInfo.label} over {years.length} yrs
                                    </p>
                                    <div className="mt-3 flex justify-center gap-2">
                                        <Badge tone="sky">{weekInfo.flight} Flight</Badge>
                                        <Badge tone="navy">{weekInfo.ground} Ground</Badge>
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-lg bg-navy-50 p-4 text-center ring-1 ring-navy-100 ring-inset">
                                    <p className="label-mono !text-[0.6rem]">Likelihood this week</p>
                                    <p className="font-display mt-1 text-5xl font-bold text-navy-800">{weekInfo.likelihood}%</p>
                                    <p className="mt-1 text-xs text-slate-500">
                                        {weekInfo.week.length} mishap{weekInfo.week.length === 1 ? '' : 's'} in {weekInfo.label} over {years.length} yrs
                                    </p>
                                    <div className="mt-3 flex justify-center gap-2">
                                        <Badge tone="sky">{weekInfo.flight} Flight</Badge>
                                        <Badge tone="navy">{weekInfo.ground} Ground</Badge>
                                    </div>
                                </div>
                            )}
                            <div className="min-w-0">
                                {band ? (
                                    <>
                                        {riskForecast.headline && (
                                            <p className="mb-3 text-sm font-medium text-navy-900">{riskForecast.headline}</p>
                                        )}
                                        {riskForecast.reasons?.length > 0 && (
                                            <div className="mb-3">
                                                <p className="label-mono mb-1.5 !text-[0.6rem]">Conditions to brief this week</p>
                                                <div className="divide-y divide-slate-100">
                                                    {riskForecast.reasons.map((r, i) => <FactorBar key={i} {...r} />)}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <p className="mb-2 text-sm text-slate-600">
                                        {weekInfo.week.length === 0
                                            ? `No mishaps historically recorded in ${weekInfo.label} — a low-risk week.`
                                            : `Assessment: this calendar week (${weekInfo.label}) has seen ${weekInfo.week.length} mishap${weekInfo.week.length === 1 ? '' : 's'} across the last ${years.length} years — occurring in ${weekInfo.distinctYears} of them. Brief crews accordingly.`}
                                    </p>
                                )}
                                {weekInfo.week.length > 0 && (
                                    <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto">
                                        {weekInfo.week.map((r, i) => (
                                            <li key={i} className="flex flex-wrap items-center gap-2 py-1.5">
                                                <span className="font-mono text-xs text-navy-800">{r.display_date}</span>
                                                <Badge tone={TYPE_TONE[r.type]}>{r.type}</Badge>
                                                <Badge tone={ENV_TONE[r.environment]}>{r.environment}</Badge>
                                                <span className="min-w-0 flex-1 truncate text-xs text-slate-600" title={r.description}>{r.location ?? '—'} — {r.description}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {band && (
                                    <p className="label-mono mt-3 !text-[0.55rem] !text-slate-400">
                                        Source: {riskForecast.source}{riskForecast.generated_at ? ` · updated ${riskForecast.generated_at}` : ''}
                                    </p>
                                )}
                            </div>
                        </div>
                        </>
                    );
                })()}
            </Panel>

            <SpiPanel spi={spi} />

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

            <CapsOverview mishaps={caps} currentYear={currentYear} />

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
