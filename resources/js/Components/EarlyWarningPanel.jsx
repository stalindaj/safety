import { Link, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { Badge, Button, Field, Modal, Panel } from '@/Components/Ui';

/*
 * Early warning — the "one step ahead" layer under the SPI. The SPI only moves
 * after a mishap in the Wing; these are signals that can come first: live
 * airfield weather, the season, and occurrences outside the Wing. They adjust
 * this week's chances (ChanceModel, measured from the Wing's own record) but
 * never change the SPI or the weekly base rate panel.
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

function OccurrenceForm({ entry, detection = null, options, onDone }) {
    const editing = Boolean(entry);
    // Confirming a news detection: start from what the watcher read, so staff only correct it.
    const start = entry ?? detection?.prefill ?? {};
    const { data, setData, post, put, processing, errors } = useForm({
        occurred_on: start.occurred_on ?? new Date().toISOString().slice(0, 10),
        region: start.region ?? 'mindanao',
        location: start.location ?? '',
        aircraft: start.aircraft ?? '',
        category: start.category ?? options.categories[0],
        summary: start.summary ?? '',
        source_url: start.source_url ?? '',
        brief_until: entry?.brief_until ?? '',
        news_detection_id: detection?.id ?? '',
    });

    const submit = (e) => {
        e.preventDefault();
        const opts = { preserveScroll: true, onSuccess: onDone };
        if (editing) put(`/external-occurrences/${entry.id}`, opts);
        else post('/external-occurrences', opts);
    };

    return (
        <form onSubmit={submit} className="space-y-4">
            {detection ? (
                <p className="rounded-lg bg-gold-50 px-3 py-2 text-sm text-navy-900 ring-1 ring-gold-200 ring-inset">
                    Filled in from the news ({detection.article_count} {detection.article_count === 1 ? 'article' : 'articles'}). Check the
                    date, place and aircraft against the articles before saving: headlines are often vague.
                </p>
            ) : (
                <p className="text-sm text-slate-600">
                    Something that happened <b>outside the Wing</b> that crews should hear about. It shows as an advisory and is
                    never counted in the SPI or the base rate.
                </p>
            )}
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
                <Button type="submit" tone="gold" disabled={processing}>
                    {processing ? 'Saving…' : editing ? 'Save Changes' : detection ? 'Log from the News' : 'Log Occurrence'}
                </Button>
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
                    {o.from_news && <Badge tone="sky">From the news · automatic</Badge>}
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

const pts = (n) => (n > 0 ? `+${n.toFixed(1)}` : n < 0 ? `−${Math.abs(n).toFixed(1)}` : '±0.0');

function Chance({ c, label, sub }) {
    const [open, setOpen] = useState(false);
    const change = Math.round((c.pct - c.base_pct) * 10) / 10;
    const factors = c.factors ?? [];
    const pending = c.pending ?? [];

    return (
        <div className="rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100 ring-inset">
            <div className="flex items-baseline gap-2">
                <p className="font-display text-3xl leading-none font-bold text-navy-800 tabular-nums">{c.pct.toFixed(1)}%</p>
                {c.base_pct != null && (
                    <span className={`text-xs font-medium tabular-nums ${change > 0 ? 'text-rose-700' : change < 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                        {pts(change)} pts from {c.base_pct.toFixed(1)}%
                    </span>
                )}
            </div>
            <p className="mt-1.5 text-sm font-medium text-navy-900">{label}</p>
            <p className="mt-0.5 text-[0.7rem] text-slate-500">Base: {sub}</p>

            {factors.length > 0 && (
                <ul className="mt-2 space-y-1 border-t border-slate-200 pt-2">
                    {factors.map((f) => (
                        <li key={f.key} className="flex items-start gap-2 text-[0.72rem] leading-snug">
                            <span className={`w-10 shrink-0 text-right font-mono tabular-nums ${f.points > 0 ? 'text-rose-700' : f.points < 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                                {pts(f.points)}
                            </span>
                            <span className="text-slate-700">
                                {f.label}
                                {open && <span className="block text-[0.68rem] text-slate-500">{f.detail} · used ×{f.multiplier.toFixed(2)}{f.raw != null ? ` (record alone ×${f.raw.toFixed(2)})` : ''}</span>}
                            </span>
                        </li>
                    ))}
                    {pending.map((f) => (
                        <li key={f.label} className="flex items-start gap-2 text-[0.72rem] leading-snug text-slate-400">
                            <span className="w-10 shrink-0 text-right font-mono">—</span>
                            <span>
                                {f.label}
                                {open && <span className="block text-[0.68rem]">{f.why}</span>}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
            {factors.length + pending.length > 0 && (
                <button type="button" onClick={() => setOpen((v) => !v)} className="label-mono mt-1.5 !text-[0.58rem] !text-navy-600 hover:!text-navy-900">
                    {open ? 'Hide how' : 'How it was worked out'}
                </button>
            )}
        </div>
    );
}

function Odds({ odds }) {
    if (!odds?.flight_week) return null;
    const of = (o) => `${o.hits} of the last ${o.weeks} weeks`;
    return (
        <>
            <div className="grid gap-3 lg:grid-cols-3">
                <Chance c={odds.flight_week} label="Flight mishap this week" sub={of(odds.flight_week)} />
                <Chance c={odds.any_week} label="Any mishap this week" sub={`flight or ground, ${of(odds.any_week)}`} />
                <Chance c={odds.bird_week} label="Bird / wildlife strike this week" sub={of(odds.bird_week)} />
            </div>
            <p className="mt-2 mb-6 text-[0.7rem] text-slate-500">
                Each condition moves the chance only as much as it did in the Wing's own record, pulled toward “no change” when the
                record is thin. <span className="text-emerald-700">Green</span> lowers it, <span className="text-rose-700">red</span> raises it.
                A lower chance in bad weather or El Niño most likely means less flying then, not safer flying, so brief the hazard anyway.
            </p>
        </>
    );
}

const VERDICT_TONE = {
    'higher than usual': 'text-rose-700',
    'lower than usual': 'text-emerald-700',
    'same as usual': 'text-slate-500',
    'too few to tell': 'text-slate-500',
};

/*
 * Pattern alerts: 2+ similar occurrences (ours or outside) within 14 days.
 */
function Patterns({ patterns = [] }) {
    if (!patterns.length) return null;
    return (
        <div className="mt-6">
            <p className="label-mono mb-2 !text-[0.6rem]">Patterns — similar occurrences close together</p>
            <ul className="grid gap-3 lg:grid-cols-2">
                {patterns.map((p, i) => (
                    <li key={i} className={`rounded-lg p-3 ring-1 ring-inset ${p.level === 'brief' ? 'bg-rose-50/60 ring-rose-200' : 'bg-amber-50/60 ring-amber-200'}`}>
                        <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-semibold text-navy-900 first-letter:uppercase">{p.text}</p>
                            <Level level={p.level} />
                        </div>
                        <ul className="mt-1.5 space-y-0.5 text-xs text-slate-600">
                            {p.items.map((e, j) => (
                                <li key={j}>
                                    <span className="font-mono">{e.display_date}</span> ·{' '}
                                    <span className={e.who === '15SW' ? 'font-semibold text-navy-900' : ''}>{e.who}</span> · {e.place}
                                    {e.aircraft && <> · {e.aircraft}</>} · {e.category}
                                </li>
                            ))}
                        </ul>
                        <p className="mt-1.5 text-[0.7rem] text-slate-500">{p.detail}</p>
                    </li>
                ))}
            </ul>
        </div>
    );
}

/*
 * News watcher — automatic. Trusted sources only; each event is decided on
 * its own (logged / waiting for a second source / for information). A person
 * can undo a log or log something anyway, and the model learns from that.
 */
const KIND_TONE = { accident: 'red', incident: 'amber', hazard: 'sky', disruption: 'neutral' };
const BACKING_TONE = { official: 'green', aviation: 'sky', outlets: 'navy', single: 'neutral' };
const TIER_MARK = { official: 'Official', aviation: 'Aviation safety' };

function Detection({ d, news, onLog }) {
    const [open, setOpen] = useState(false);
    const post = (action) => router.post(`/news-detections/${d.id}/${action}`, {}, { preserveScroll: true });
    const logged = d.status === 'confirmed';
    const removed = d.status === 'dismissed';

    return (
        <li className="py-3">
            <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-navy-800">{d.display_date}</span>
                <Badge tone={KIND_TONE[d.kind]}>{news.kinds[d.kind] ?? d.kind}</Badge>
                {d.region && <Badge tone={d.region === 'mindanao' ? 'gold' : 'neutral'}>{d.place ?? news.regions[d.region]}</Badge>}
                <Badge tone={BACKING_TONE[d.backing.level]}>{d.backing.verified ? '✓ ' : ''}{d.backing.label}</Badge>
                {logged && <Badge tone="gold">{d.auto ? 'Logged automatically' : 'Logged by staff'}</Badge>}
                {d.relevance != null && !removed && (
                    <span className="text-[0.7rem] text-slate-500" title="How likely the Safety Office is to keep this logged, learned from past Undo / Log anyway decisions">
                        Model: <b className="text-navy-800">{Math.round(d.relevance * 100)}%</b> likely to keep
                    </span>
                )}
            </div>
            <p className="mt-1 text-sm font-medium text-navy-900">{d.headline}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.7rem] text-slate-500">
                {d.aircraft && <span>Aircraft: {d.aircraft}</span>}
                <span>{d.category}</span>
                {d.why.length > 0 && <span>Why: {d.why.join(' · ')}</span>}
                {d.learned?.up?.length > 0 && <span className="text-emerald-700">Model likes: {d.learned.up.join(', ')}</span>}
                {d.learned?.down?.length > 0 && <span className="text-rose-600">Model doubts: {d.learned.down.join(', ')}</span>}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setOpen((v) => !v)} className="label-mono !text-navy-600 hover:!text-navy-900 text-left">
                    {open ? 'Hide' : 'Show'} {d.article_count} {d.article_count === 1 ? 'article' : 'articles'}
                    <span className="normal-case"> · {d.sources.slice(0, 4).map((s) => s.name).join(', ')}</span>
                </button>
                <span className="grow" />
                {removed ? (
                    <button type="button" onClick={() => post('restore')} className="label-mono !text-navy-600 hover:!text-navy-900 px-1.5">Give back to watcher</button>
                ) : logged ? (
                    <button type="button" onClick={() => post('dismiss')} className="label-mono !text-slate-500 hover:!text-rose-700 px-1.5">
                        {d.auto ? 'Undo' : 'Remove'}
                    </button>
                ) : (
                    <>
                        {d.status === 'pending' && (
                            <button type="button" onClick={() => post('dismiss')} className="label-mono !text-slate-500 hover:!text-rose-700 px-1.5">Not relevant</button>
                        )}
                        <Button tone={d.status === 'pending' ? 'gold' : 'ghost'} className="!px-2.5 !py-1" onClick={() => onLog(d)}>Log anyway</Button>
                    </>
                )}
            </div>
            {open && (
                <ul className="mt-1.5 space-y-1 border-l-2 border-slate-100 pl-3">
                    {d.articles.map((a, i) => (
                        <li key={i} className="text-xs">
                            <a href={a.url} target="_blank" rel="noreferrer" className="text-navy-700 hover:underline">{a.title} ↗</a>
                            <span className="text-slate-400">
                                {' '}· {a.source}{TIER_MARK[a.tier] ? ` (${TIER_MARK[a.tier]})` : ''} · {a.date}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </li>
    );
}

function NewsGroup({ title, hint, items, news, onLog, open: startOpen = true, limit = 5 }) {
    const [open, setOpen] = useState(startOpen);
    const [all, setAll] = useState(false);
    if (!items.length) return null;
    const shown = all ? items : items.slice(0, limit);

    return (
        <div className="mt-3">
            <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-baseline gap-2 text-left">
                <span className="label-mono !text-[0.6rem] !text-navy-700">{open ? '▾' : '▸'} {title} ({items.length})</span>
                <span className="text-[0.7rem] text-slate-500">{hint}</span>
            </button>
            {open && (
                <>
                    <ul className="divide-y divide-slate-100">
                        {shown.map((d) => <Detection key={d.id} d={d} news={news} onLog={onLog} />)}
                    </ul>
                    {items.length > limit && (
                        <button type="button" onClick={() => setAll((v) => !v)} className="label-mono !text-navy-600 hover:!text-navy-900">
                            {all ? 'Show fewer' : `Show all ${items.length}`}
                        </button>
                    )}
                </>
            )}
        </div>
    );
}

function NewsWatch({ news, onLog }) {
    const [checking, setChecking] = useState(false);
    if (!news) return null;

    const { check = [], logged = [], waiting = [], info = [], dismissed = [], model, last_check: last, sources } = news;
    const runCheck = () => router.post('/news-watch/check', {}, {
        preserveScroll: true,
        onStart: () => setChecking(true),
        onFinish: () => setChecking(false),
    });

    return (
        <div className="mt-6 border-t border-slate-100 pt-4">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
                <p className="label-mono !text-[0.6rem]">Watched in the news — automatic, trusted sources only</p>
                <div className="flex items-center gap-3">
                    <span className="text-[0.7rem] text-slate-500">
                        {last ? `Checked ${last.at} · runs every hour` : 'Not checked yet'}
                        {last?.errors?.length > 0 && <span className="text-amber-700"> · {last.errors.length} sources unreachable</span>}
                    </span>
                    <Button tone="ghost" className="!px-2.5 !py-1" onClick={runCheck} disabled={checking}>
                        {checking ? 'Checking…' : 'Check now'}
                    </Button>
                </div>
            </div>
            <p className="text-xs text-slate-500">
                Reads {sources.searches} news searches and the {sources.feeds.join(', ')} feeds, and <b>ignores outlets not on the trusted list</b>
                {last ? ` (${last.untrusted} of ${last.articles} articles skipped last check)` : ''}. An event is <b>verified</b> by an official or
                aviation-safety source, a newsroom quoting an official body (e.g. “PAF:”, “CAAP says”), or two independent newsrooms. Verified
                events that matter to the Wing (our aircraft type, Mindanao, military, a top cause, a crash) are <b>logged automatically</b> as
                outside occurrences.{' '}
                {model.ready ? (
                    <>
                        The model has learned from {model.confirmed} kept and {model.dismissed} removed by staff
                        {model.accuracy != null ? `, and gets ${model.accuracy}% of those right` : ''}; it hands doubtful cases to a person.
                    </>
                ) : (
                    <>
                        Undo and Log anyway teach the model (it joins in after {model.needed_each} of each; now {model.confirmed} and {model.dismissed}).
                    </>
                )}
            </p>

            {check.length + logged.length + waiting.length + info.length === 0 && (
                <p className="py-3 text-sm text-slate-500">Nothing flying-related from trusted sources in the last 45 days.</p>
            )}
            <NewsGroup title="Needs a person" hint="The model disagrees with the rules on these." items={check} news={news} onLog={onLog} />
            <NewsGroup title="Logged automatically" hint="Verified and relevant. Shown under Outside the Wing above." items={logged} news={news} onLog={onLog} />
            <NewsGroup title="Waiting for a second source" hint="One newsroom so far; logged if another confirms within 7 days." items={waiting} news={news} onLog={onLog} open={false} />
            <NewsGroup title="For information" hint="Verified, but not close enough to the Wing to log." items={info} news={news} onLog={onLog} open={false} />
            <NewsGroup title="Removed by staff" hint="Give one back to let the watcher decide again." items={dismissed} news={news} onLog={onLog} open={false} />
        </div>
    );
}

/*
 * Weather at the time — from the watcher notebook. Was bad weather reported on
 * our mishap days more often than on ordinary days at the same airfields? And
 * what was the weather at each recent mishap? Present is not the same as cause.
 */
const WX_LEVEL = {
    brief: { label: 'Bad weather', tone: 'red' },
    aware: { label: 'Some weather', tone: 'amber' },
    clear: { label: 'No hazards', tone: 'green' },
    no_data: { label: 'No data', tone: 'neutral' },
};

function WeatherSource({ w }) {
    if (!w || w.source === 'none') return <span>{w?.note ?? 'Not checked yet'}</span>;
    const when = w.window === 'time' ? 'at the time' : 'that day';
    return w.source === 'observed' ? (
        <span>{w.station_name} airfield {w.station} · {w.distance_km} km away · reports {when}</span>
    ) : (
        <span>Weather-model estimate {when} (no airfield close enough)</span>
    );
}

function WeatherLink({ link }) {
    const [group, setGroup] = useState('flight');
    if (!link) {
        return (
            <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-600 ring-1 ring-slate-100 ring-inset">
                Not checked yet. Run the <b>watcher notebook</b> (safety_watcher.ipynb) to link every mishap to the weather at its time and place.
            </p>
        );
    }

    const rows = (link.rows ?? []).filter((r) => r.group === group);
    const lead = rows.find((r) => r.hazard === 'Any brief-level weather');
    const c = link.counts ?? {};
    const who = group === 'flight' ? 'flight mishap days' : 'mishap days';

    return (
        <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-500">
                    {link.period} · airfields within {link.max_distance_km} km · updated {link.updated}
                </p>
                <div className="flex gap-1">
                    {[['flight', 'Flight'], ['all', 'Flight + ground']].map(([v, l]) => (
                        <button
                            key={v}
                            type="button"
                            onClick={() => setGroup(v)}
                            className={`rounded-md px-2.5 py-1 text-xs font-medium ${group === v ? 'bg-navy-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                            {l}
                        </button>
                    ))}
                </div>
            </div>

            {lead && lead.mishap_days > 0 && (
                <p className="mb-3 text-sm text-navy-900">
                    Bad weather was reported on <b>{pct(lead.mishap_pct)}</b> of our {who}, against <b>{pct(lead.usual_pct)}</b> of
                    ordinary days at the same airfields —{' '}
                    <span className={`font-semibold ${VERDICT_TONE[lead.verdict] ?? ''}`}>{lead.verdict}</span>.
                </p>
            )}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="label-mono border-b border-slate-200 text-left !text-[0.58rem]">
                                <th className="py-1.5 pr-2 font-normal">Weather</th>
                                <th className="py-1.5 pr-2 text-right font-normal">Our {group === 'flight' ? 'flight ' : ''}mishap days</th>
                                <th className="py-1.5 pr-2 text-right font-normal">Ordinary days</th>
                                <th className="py-1.5 font-normal">Verdict</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {rows.map((r) => (
                                <tr key={r.hazard}>
                                    <td className="py-2 pr-2 text-navy-900">{r.hazard}</td>
                                    <td className="py-2 pr-2 text-right tabular-nums">
                                        {pct(r.mishap_pct)} <span className="text-[0.7rem] text-slate-400">({r.mishap_hits} of {r.mishap_days})</span>
                                    </td>
                                    <td className="py-2 pr-2 text-right tabular-nums">{pct(r.usual_pct)}</td>
                                    <td className={`py-2 text-xs font-medium ${VERDICT_TONE[r.verdict] ?? ''}`}>{r.verdict}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p className="mt-2 text-[0.7rem] text-slate-500">
                        Real airfield reports only (Iowa State METAR archive) for {c.observed ?? 0} of {c.mishaps ?? 0} mishaps.
                        {c.estimate ? ` ${c.estimate} more have a weather-model estimate, not counted here.` : ''}
                        {link.unmapped?.length ? ` Not matched to a place: ${link.unmapped.join(', ')}.` : ''}
                    </p>
                </div>

                <div>
                    <p className="label-mono mb-1 !text-[0.58rem]">Weather at our latest mishaps</p>
                    <ul className="divide-y divide-slate-100">
                        {(link.recent ?? []).map((m) => {
                            const lv = WX_LEVEL[m.weather?.level] ?? WX_LEVEL.no_data;
                            return (
                                <li key={m.id} className="py-2">
                                    <div className="flex items-start justify-between gap-3">
                                        <Link href={`/mishaps?year=${m.year}&focus=${m.id}`} className="min-w-0 text-sm text-navy-900 hover:underline">
                                            <span className="font-mono text-xs text-navy-800">{m.display_date}{m.time ? ` ${m.time}` : ''}</span>{' '}
                                            <span className="font-medium">{m.location ?? '—'}</span>
                                            <span className="text-xs text-slate-500"> · {m.environment} · {m.category ?? 'uncategorised'}</span>
                                        </Link>
                                        <Badge tone={lv.tone}>{lv.label}</Badge>
                                    </div>
                                    {m.weather?.hazards?.length > 0 && (
                                        <HazardLine label="Reported" items={m.weather.hazards} empty="" />
                                    )}
                                    <p className="text-[0.7rem] text-slate-500"><WeatherSource w={m.weather} /></p>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </div>

            <p className="mt-2 text-[0.7rem] text-slate-500">
                Weather being present does not mean weather caused the mishap — the safety board decides the cause.
            </p>
        </div>
    );
}

export default function EarlyWarningPanel({ data }) {
    const [editing, setEditing] = useState(null); // null | 'new' | occurrence | { detection } (confirming from the news)
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

            <Patterns patterns={data.patterns} />

            <NewsWatch news={data.news} onLog={(d) => setEditing({ detection: d })} />

            <div className="mt-6 border-t border-slate-100 pt-4">
                <p className="label-mono mb-2 !text-[0.6rem]">Weather at the time of our mishaps — watcher notebook</p>
                <WeatherLink link={data.weather_link} />
            </div>

            <p className="label-mono mt-4 !text-[0.55rem] !text-slate-400">
                Experimental · base chances are how often it happened (last 5 years), adjusted by this week's conditions using the Wing's own record · may be right or wrong · does not change the SPI
            </p>

            <Modal
                open={editing !== null}
                onClose={() => setEditing(null)}
                title={editing?.detection ? 'Log from the News' : editing && editing !== 'new' ? 'Edit Outside Occurrence' : 'Log an Outside Occurrence'}
            >
                {editing !== null && (
                    <OccurrenceForm
                        key={editing === 'new' ? 'new' : editing.detection ? `news-${editing.detection.id}` : editing.id}
                        entry={editing === 'new' || editing.detection ? null : editing}
                        detection={editing.detection ?? null}
                        options={options}
                        onDone={() => setEditing(null)}
                    />
                )}
            </Modal>
        </Panel>
    );
}
