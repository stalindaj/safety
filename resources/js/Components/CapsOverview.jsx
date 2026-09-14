import { useMemo, useState } from 'react';
import { Link } from '@inertiajs/react';
import { Badge, Panel } from '@/Components/Ui';

const TYPE_TONE = { accident: 'red', incident: 'amber', event: 'neutral' };
const ENV_TONE = { flight: 'sky', ground: 'navy' };

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

export default function CapsOverview({ mishaps, currentYear }) {
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
                                    <Link
                                        href={`/mishaps?year=${m.year}&focus=${m.id}`}
                                        title="Open this record in Mishap Records"
                                        className="group -mx-2 -my-1 block min-w-0 rounded-md px-2 py-1 transition hover:bg-slate-50"
                                    >
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-mono text-xs text-navy-800">{m.display_date}</span>
                                            <span className="text-sm font-medium text-navy-900 group-hover:underline">{m.location ?? '—'}</span>
                                            <Badge tone={TYPE_TONE[m.type]}>{m.type}</Badge>
                                            <Badge tone={ENV_TONE[m.environment]}>{m.environment}</Badge>
                                            <span className="label-mono ml-auto !text-navy-500 opacity-0 transition group-hover:opacity-100">View record →</span>
                                        </div>
                                        <p className="mt-1 line-clamp-2 text-xs text-slate-600 group-hover:text-navy-900">{m.description}</p>
                                    </Link>
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
