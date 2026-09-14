import { useMemo, useState } from 'react';
import { Link } from '@inertiajs/react';
import { Badge, Modal, Panel } from '@/Components/Ui';

/*
 * Weekly base rate + conditions to brief, from the Colab forecast notebook.
 * The notebook writes one row per week; this only displays them, with a
 * week-changer and the Wing's past mishaps in the same calendar week.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayIdx = (m, d) => Math.floor(Date.UTC(2001, m - 1, d) / 86400000); // day-of-year, year-agnostic
const mondayOf = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // back up to Monday
    return d.toISOString().slice(0, 10);
};

const TYPE_TONE = { accident: 'red', incident: 'amber', event: 'neutral' };
const ENV_TONE = { flight: 'sky', ground: 'navy' };

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

export default function WeeklyForecastPanel({ records, years, today, forecasts = [] }) {
    const [weekIdx, setWeekIdx] = useState(-1); // -1 = default to the week containing today
    const [open, setOpen] = useState(null); // the past mishap being viewed
    const [envFilter, setEnvFilter] = useState(null); // null | 'flight' | 'ground' — from the chips

    const forecastMap = useMemo(() => Object.fromEntries(forecasts.map((f) => [f.week_start, f])), [forecasts]);
    // Navigate among the weeks the notebook produced, so the viewed week
    // always has a forecast (and its factor bars) rather than falling back.
    const weeks = useMemo(() => forecasts.map((f) => f.week_start).sort(), [forecasts]);
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

    // Changing week clears the Flight / Ground filter.
    const goTo = (i) => { setWeekIdx(i); setEnvFilter(null); };
    const shiftIdx = (delta) => goTo(Math.min(Math.max(idx + delta, 0), weeks.length - 1));
    const shown = envFilter ? weekInfo.week.filter((r) => r.environment === envFilter) : weekInfo.week;
    const band = riskForecast ? (RISK_BAND[riskForecast.risk_level] ?? RISK_BAND.moderate) : null;

    return (
        <Panel
            title="Weekly Base Rate"
            className="mb-5"
            action={
                <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => shiftIdx(-1)} disabled={idx <= 0} title="Previous week"
                        className="rounded-md px-2 py-1 font-mono text-xs text-navy-700 ring-1 ring-slate-300 ring-inset hover:bg-slate-50 disabled:opacity-30">◀</button>
                    <span className="label-mono !text-navy-800 min-w-32 text-center">{weekInfo.label}</span>
                    <button type="button" onClick={() => shiftIdx(1)} disabled={idx >= weeks.length - 1} title="Next week"
                        className="rounded-md px-2 py-1 font-mono text-xs text-navy-700 ring-1 ring-slate-300 ring-inset hover:bg-slate-50 disabled:opacity-30">▶</button>
                    {idx !== defaultIdx && (
                        <button type="button" onClick={() => goTo(-1)}
                            className="label-mono !text-gold-700 hover:!text-gold-800 ml-1">This week</button>
                    )}
                </div>
            }
        >
            <div className="grid items-start gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
                {band ? (
                    <div className={`rounded-lg p-4 text-center ring-1 ring-inset ${band.tile}`}>
                        <p className="label-mono !text-[0.6rem]">
                            {riskForecast.risk_level === 'baseline' ? 'Weekly base rate' : 'Risk this week'}
                        </p>
                        {riskForecast.risk_level === 'baseline' ? (
                            <>
                                <p className={`font-display mt-1 text-4xl font-bold ${band.text}`}>{riskForecast.likelihood}%</p>
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
                        <EnvChips flight={weekInfo.flight} ground={weekInfo.ground} value={envFilter} onChange={setEnvFilter} />
                    </div>
                ) : (
                    <div className="rounded-lg bg-navy-50 p-4 text-center ring-1 ring-navy-100 ring-inset">
                        <p className="label-mono !text-[0.6rem]">Likelihood this week</p>
                        <p className="font-display mt-1 text-5xl font-bold text-navy-800">{weekInfo.likelihood}%</p>
                        <p className="mt-1 text-xs text-slate-500">
                            {weekInfo.week.length} mishap{weekInfo.week.length === 1 ? '' : 's'} in {weekInfo.label} over {years.length} yrs
                        </p>
                        <EnvChips flight={weekInfo.flight} ground={weekInfo.ground} value={envFilter} onChange={setEnvFilter} />
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
                        <p className="label-mono mb-1 !text-[0.6rem]">
                            Past mishaps in {weekInfo.label}
                            {envFilter && (
                                <>
                                    {' '}· {envFilter} only{' '}
                                    <button type="button" onClick={() => setEnvFilter(null)} className="!text-rose-500 hover:!text-rose-700">Show all ✕</button>
                                </>
                            )}
                        </p>
                    )}
                    {shown.length > 0 && (
                        <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto">
                            {shown.map((r) => (
                                <li key={r.id}>
                                    <button
                                        type="button"
                                        onClick={() => setOpen(r)}
                                        title="Open the details"
                                        className="group flex w-full flex-wrap items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition hover:bg-slate-50"
                                    >
                                        <span className="font-mono text-xs text-navy-800">{r.display_date}</span>
                                        <Badge tone={TYPE_TONE[r.type]}>{r.type}</Badge>
                                        <Badge tone={ENV_TONE[r.environment]}>{r.environment}</Badge>
                                        <span className="min-w-0 flex-1 truncate text-xs text-slate-600 group-hover:text-navy-900">{r.location ?? '—'} — {r.description}</span>
                                        <span className="label-mono shrink-0 !text-navy-500 opacity-0 transition group-hover:opacity-100">View →</span>
                                    </button>
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

            <Modal open={open !== null} onClose={() => setOpen(null)} title={open ? `${open.display_date} — Mishap Details` : ''}>
                {open && <MishapDetail m={open} />}
            </Modal>
        </Panel>
    );
}

// Flight / Ground counts that filter the list of past mishaps (click again to clear).
function EnvChips({ flight, ground, value, onChange }) {
    const chip = (env, count, label) => {
        const active = value === env;
        return (
            <button
                type="button"
                disabled={count === 0}
                onClick={() => onChange(active ? null : env)}
                aria-pressed={active}
                title={count ? (active ? 'Show all' : `Show only ${env} mishaps`) : `No ${env} mishaps`}
                className={`rounded-full transition disabled:cursor-default disabled:opacity-50 ${
                    active ? 'ring-2 ring-navy-700 ring-offset-1' : count ? 'hover:-translate-y-px hover:shadow-sm' : ''
                }`}
            >
                <Badge tone={ENV_TONE[env]}>{count} {label}</Badge>
            </button>
        );
    };
    return (
        <div className="mt-3 flex justify-center gap-2">
            {chip('flight', flight, 'Flight')}
            {chip('ground', ground, 'Ground')}
        </div>
    );
}

function Section({ title, children }) {
    return (
        <section>
            <h3 className="label-mono mb-1.5 !text-navy-700">{title}</h3>
            {children}
        </section>
    );
}

function NotYet({ children }) {
    return <p className="text-sm text-slate-400 italic">{children}</p>;
}

function MishapDetail({ m }) {
    const facts = [
        ['Location', m.location],
        ['Safety occurrence', m.category],
        ['Aircraft', m.aircraft],
        ['Phase of flight', m.phase],
    ].filter(([, v]) => v);

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
                <Badge tone={TYPE_TONE[m.type]}>{m.type}</Badge>
                <Badge tone={ENV_TONE[m.environment]}>{m.environment}</Badge>
                {facts.map(([k, v]) => (
                    <span key={k} className="text-xs text-slate-600">
                        <span className="text-slate-400">{k}:</span> <span className="font-medium text-navy-900">{v}</span>
                    </span>
                ))}
            </div>

            <Section title={`Brief description of the ${m.type}`}>
                <p className="text-sm leading-relaxed whitespace-pre-line text-slate-700">{m.description}</p>
            </Section>

            <Section title="Causes">
                {m.causes?.length ? (
                    <ul className="space-y-2">
                        {m.causes.map((c, i) => (
                            <li key={i} className="text-sm text-slate-700">
                                {c.factor && <Badge tone={/primary/i.test(c.factor) ? 'red' : 'amber'} className="mr-2">{c.factor}</Badge>}
                                {c.detail}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <NotYet>Not recorded yet. Causes are added with the board's Corrective Action Plan.</NotYet>
                )}
            </Section>

            <Section title="Lessons Learned">
                {m.lesson_learned ? (
                    <p className="text-sm leading-relaxed whitespace-pre-line text-slate-700">{m.lesson_learned}</p>
                ) : (
                    <NotYet>Not recorded yet. Add it in Mishap Records (Post-Investigation) once the investigation closes.</NotYet>
                )}
            </Section>
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
                <Link href={`/mishaps?year=${m.year}&focus=${m.id}`} className="label-mono !text-navy-700 hover:!text-navy-900 rounded-md px-3 py-2 ring-1 ring-slate-200 ring-inset transition hover:ring-navy-200">
                    Open in Mishap Records
                </Link>
                <Link href={`/mishaps/${m.id}/plan`} className="label-mono !text-black/85 rounded-md bg-gold-500 px-3 py-2 transition hover:bg-gold-400">
                    Corrective Action Plan →
                </Link>
            </div>
        </div>
    );
}
