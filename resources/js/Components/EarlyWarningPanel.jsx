import { router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { Badge, Button, Field, Modal, Panel } from '@/Components/Ui';

/*
 * Early warning — the "one step ahead" layer under the SPI. The SPI only moves
 * after a mishap in the Wing; these are signals that can come first: live
 * airfield weather, the season, and occurrences outside the Wing. Advisories
 * only — they never change the SPI or the base rate.
 */
const LEVEL = {
    brief: { label: 'Brief crews', tone: 'red' },
    aware: { label: 'Be aware', tone: 'amber' },
    clear: { label: 'No hazards', tone: 'green' },
    info: { label: 'For information', tone: 'neutral' },
};

function Level({ level }) {
    const l = LEVEL[level] ?? LEVEL.info;
    return <Badge tone={l.tone}>{l.label}</Badge>;
}

function HazardLine({ label, items, empty }) {
    return (
        <p className="text-xs leading-snug">
            <span className="label-mono mr-1.5 !text-[0.58rem]">{label}</span>
            {items.length ? (
                items.map((h, i) => (
                    <span key={i} className={h.level === 'brief' ? 'font-semibold text-rose-700' : 'text-amber-700'}>
                        {i > 0 && <span className="text-slate-400"> · </span>}
                        {h.text}
                    </span>
                ))
            ) : (
                <span className="text-slate-500">{empty}</span>
            )}
        </p>
    );
}

function Weather({ weather }) {
    if (!weather?.available) {
        return (
            <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-600 ring-1 ring-slate-100 ring-inset">
                Live airfield weather couldn't be reached{weather?.checked_at ? ` (checked ${weather.checked_at})` : ''}. This is not an all-clear: check PAGASA and the local weather office.
            </p>
        );
    }
    return (
        <>
            <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {weather.stations.map((s) => (
                    <li key={s.id} className="rounded-lg border border-slate-200 p-3">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-navy-900">
                                    {s.name} <span className="font-mono text-[0.7rem] font-normal text-slate-400">{s.id}</span>
                                </p>
                                <p className="truncate text-[0.7rem] text-slate-500" title={s.serves}>{s.serves}</p>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                                <Level level={s.level} />
                                <Badge tone={s.region === 'Mindanao' ? 'gold' : 'neutral'}>{s.region}</Badge>
                            </div>
                        </div>
                        <div className="mt-2 space-y-1">
                            {s.reporting ? (
                                <>
                                    <HazardLine label={`Now · ${s.observed}`} items={s.now} empty="No hazards reported" />
                                    {s.stale && (
                                        <p className="text-[0.7rem] text-slate-500">Last report is {s.age_hours} h old (airport may not report overnight).</p>
                                    )}
                                </>
                            ) : (
                                <p className="text-xs text-slate-500">No current report from this airport.</p>
                            )}
                            {s.forecast_until && (
                                <HazardLine label={`Next · to ${s.forecast_until}`} items={s.next} empty="No hazards forecast" />
                            )}
                        </div>
                        {(s.raw || s.raw_taf) && (
                            <details className="mt-1.5">
                                <summary className="label-mono cursor-pointer !text-[0.58rem]">Raw report</summary>
                                <p className="mt-1 font-mono text-[0.65rem] leading-relaxed break-all text-slate-500">
                                    {s.raw}
                                    {s.raw_taf && <><br />{s.raw_taf}</>}
                                </p>
                            </details>
                        )}
                    </li>
                ))}
            </ul>
            <p className="mt-2 text-[0.7rem] text-slate-500">
                {weather.not_covered} Source: NOAA Aviation Weather Center (METAR / TAF), refreshed every 30 minutes · checked {weather.checked_at}.
            </p>
        </>
    );
}

function OccurrenceForm({ entry, options, onDone }) {
    const editing = Boolean(entry);
    const { data, setData, post, put, processing, errors } = useForm({
        occurred_on: entry?.occurred_on ?? new Date().toISOString().slice(0, 10),
        region: entry?.region ?? 'mindanao',
        location: entry?.location ?? '',
        aircraft: entry?.aircraft ?? '',
        category: entry?.category ?? options.categories[0],
        summary: entry?.summary ?? '',
        source_url: entry?.source_url ?? '',
        brief_until: entry?.brief_until ?? '',
    });

    const submit = (e) => {
        e.preventDefault();
        const opts = { preserveScroll: true, onSuccess: onDone };
        if (editing) put(`/external-occurrences/${entry.id}`, opts);
        else post('/external-occurrences', opts);
    };

    return (
        <form onSubmit={submit} className="space-y-4">
            <p className="text-sm text-slate-600">
                Something that happened <b>outside the Wing</b> that crews should hear about. It shows as an advisory and is
                never counted in the SPI or the base rate.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Date it happened" error={errors.occurred_on}>
                    <input type="date" className="field" value={data.occurred_on} onChange={(e) => setData('occurred_on', e.target.value)} />
                </Field>
                <Field label="Area" error={errors.region}>
                    <select className="field" value={data.region} onChange={(e) => setData('region', e.target.value)}>
                        {Object.entries(options.regions).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                </Field>
                <Field label="Location" error={errors.location}>
                    <input className="field" placeholder="e.g. Tacloban airport" value={data.location} onChange={(e) => setData('location', e.target.value)} />
                </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="What kind" error={errors.category}>
                    <select className="field" value={data.category} onChange={(e) => setData('category', e.target.value)}>
                        {options.categories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                </Field>
                <Field label="Aircraft type (if any)" error={errors.aircraft}>
                    <input className="field" list="ew-aircraft" placeholder="e.g. AW-109, or a civil type" value={data.aircraft} onChange={(e) => setData('aircraft', e.target.value)} />
                    <datalist id="ew-aircraft">
                        {options.aircraft.map((a) => <option key={a} value={a} />)}
                    </datalist>
                </Field>
            </div>
            <Field label="What happened" error={errors.summary}>
                <textarea className="field min-h-20" placeholder="e.g. Bird strike on approach, windshield cracked, landed safely" value={data.summary} onChange={(e) => setData('summary', e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Source link (optional)" className="sm:col-span-2" error={errors.source_url}>
                    <input className="field" type="url" placeholder="https://…" value={data.source_url} onChange={(e) => setData('source_url', e.target.value)} />
                </Field>
                <Field label="Brief until" error={errors.brief_until}>
                    <input type="date" className="field" value={data.brief_until} onChange={(e) => setData('brief_until', e.target.value)} />
                </Field>
            </div>
            <p className="-mt-2 text-xs text-slate-500">Leave "Brief until" empty to keep it on the dashboard for {options.default_days} days.</p>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <Button type="button" tone="ghost" onClick={onDone}>Cancel</Button>
                <Button type="submit" tone="gold" disabled={processing}>{processing ? 'Saving…' : editing ? 'Save Changes' : 'Log Occurrence'}</Button>
            </div>
        </form>
    );
}

function Occurrence({ o, onEdit }) {
    const remove = () => {
        if (window.confirm('Remove this outside occurrence?')) {
            router.delete(`/external-occurrences/${o.id}`, { preserveScroll: true });
        }
    };
    return (
        <li className={`py-3 ${o.active ? '' : 'opacity-60'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-navy-800">{o.display_date}</span>
                    <span className="text-sm font-medium text-navy-900">{o.location}</span>
                    <Badge tone={o.region === 'mindanao' ? 'gold' : 'neutral'}>{o.region_label}</Badge>
                    {o.active ? <Level level={o.level} /> : <Badge tone="neutral">Expired {o.display_until}</Badge>}
                </div>
                <div className="shrink-0">
                    <button type="button" onClick={() => onEdit(o)} className="label-mono !text-navy-600 hover:!text-navy-900 px-1.5">Edit</button>
                    <button type="button" onClick={remove} className="label-mono !text-rose-500 hover:!text-rose-700 px-1.5">Remove</button>
                </div>
            </div>
            <p className="mt-1 text-xs text-slate-600">
                <span className="font-medium text-navy-900">{o.category}</span>
                {o.aircraft && <> · {o.aircraft}</>} — {o.summary}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.7rem] text-slate-500">
                {o.why.length > 0 ? <span>Relevant: {o.why.join(' · ')}</span> : <span>No direct match to the Wing</span>}
                {o.active && <span>Brief until {o.display_until}</span>}
                {o.source_url && (
                    <a href={o.source_url} target="_blank" rel="noreferrer" className="text-navy-700 hover:underline">Source ↗</a>
                )}
            </div>
        </li>
    );
}

const pct = (n) => `${Math.round(n)}%`;

function Chance({ value, label, sub }) {
    return (
        <div className="rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100 ring-inset">
            <p className="font-display text-3xl leading-none font-bold text-navy-800 tabular-nums">{pct(value)}</p>
            <p className="mt-1.5 text-sm font-medium text-navy-900">{label}</p>
            <p className="mt-0.5 text-[0.7rem] text-slate-500">{sub}</p>
        </div>
    );
}

function Odds({ odds }) {
    if (!odds?.flight_week) return null;
    const of = (o) => `${o.hits} of the last ${o.weeks} weeks`;
    return (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <Chance value={odds.flight_week.pct} label="Flight mishap this week" sub={of(odds.flight_week)} />
            <Chance value={odds.any_week.pct} label="Any mishap this week" sub={`Flight or ground · ${of(odds.any_week)}`} />
            <Chance
                value={odds.bird_week.pct}
                label="Bird / wildlife strike this week"
                sub={`${odds.bird_week.label}${odds.bird_week.other_pct != null ? ` · other weeks ${pct(odds.bird_week.other_pct)}` : ''}`}
            />
        </div>
    );
}

const VERDICT_TONE = {
    'higher than usual': 'text-rose-700',
    'lower than usual': 'text-emerald-700',
    'same as usual': 'text-slate-500',
    'too few to tell': 'text-slate-500',
};

export default function EarlyWarningPanel({ data }) {
    const [editing, setEditing] = useState(null); // null | 'new' | occurrence
    const [showPast, setShowPast] = useState(false);
    if (!data) return null;

    const { odds, weather, season = [], external = [], options } = data;
    const active = external.filter((o) => o.active);
    const past = external.filter((o) => !o.active);

    return (
        <Panel
            title="Predictive Safety Forecast"
            className="mb-5"
            action={<Badge tone="gold">Experimental</Badge>}
        >
            <Odds odds={odds} />

            <p className="label-mono mb-2 !text-[0.6rem]">Airfield weather — now and next ~24 h (Mindanao first)</p>
            <Weather weather={weather} />

            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
                <div>
                    <p className="label-mono mb-1 !text-[0.6rem]">This season</p>
                    <ul className="divide-y divide-slate-100">
                        {season.map((s, i) => (
                            <li key={i} className="py-2.5">
                                <div className="flex items-start justify-between gap-3">
                                    <p className="text-sm font-medium text-navy-900">{s.text}</p>
                                    <Level level={s.level} />
                                </div>
                                {s.chance ? (
                                    <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-xs text-slate-600">
                                        <span className="font-display text-xl font-bold text-navy-800 tabular-nums">{pct(s.chance.pct)}</span>
                                        <span>{s.chance.what.toLowerCase()} chance a week</span>
                                        <span className="text-slate-400">·</span>
                                        <span>usual {pct(s.chance.other_pct)}</span>
                                        <span className={`font-medium ${VERDICT_TONE[s.chance.verdict] ?? ''}`}>({s.chance.verdict})</span>
                                    </p>
                                ) : (
                                    <p className="mt-0.5 text-xs text-slate-500">{s.detail}</p>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>

                <div>
                    <div className="mb-1 flex items-center justify-between gap-3">
                        <p className="label-mono !text-[0.6rem]">Outside the Wing — occurrences to learn from</p>
                        <Button tone="gold" className="!px-2.5 !py-1" onClick={() => setEditing('new')}>+ Log Occurrence</Button>
                    </div>
                    {active.length === 0 ? (
                        <p className="py-3 text-sm text-slate-500">
                            Nothing logged right now. When a bird strike, engine problem or weather event happens elsewhere — especially
                            in Mindanao or on our aircraft types — log it here so crews hear about it.
                        </p>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {active.map((o) => <Occurrence key={o.id} o={o} onEdit={setEditing} />)}
                        </ul>
                    )}
                    {past.length > 0 && (
                        <>
                            <button type="button" onClick={() => setShowPast((v) => !v)} className="label-mono mt-2 !text-navy-600 hover:!text-navy-900">
                                {showPast ? 'Hide' : 'Show'} expired ({past.length})
                            </button>
                            {showPast && (
                                <ul className="divide-y divide-slate-100">
                                    {past.map((o) => <Occurrence key={o.id} o={o} onEdit={setEditing} />)}
                                </ul>
                            )}
                        </>
                    )}
                </div>
            </div>

            <p className="label-mono mt-4 !text-[0.55rem] !text-slate-400">
                Experimental · chances are how often it happened before, from the Wing's own records · may be right or wrong · does not change the SPI
            </p>

            <Modal
                open={editing !== null}
                onClose={() => setEditing(null)}
                title={editing && editing !== 'new' ? 'Edit Outside Occurrence' : 'Log an Outside Occurrence'}
            >
                {editing !== null && (
                    <OccurrenceForm
                        key={editing === 'new' ? 'new' : editing.id}
                        entry={editing === 'new' ? null : editing}
                        options={options}
                        onDone={() => setEditing(null)}
                    />
                )}
            </Modal>
        </Panel>
    );
}
