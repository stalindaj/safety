import { Head, Link, router, useForm } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Badge, Button, EmptyState, Field, Modal, PageHeader, Panel, Table } from '@/Components/Ui';

const TYPE_TONE = { accident: 'red', incident: 'amber', event: 'neutral' };
const ENV_TONE = { flight: 'sky', ground: 'navy' };
const CAP_STATUS = {
    complied: { label: 'Complied', tone: 'green' },
    ongoing: { label: 'Ongoing', tone: 'sky' },
    pending: { label: 'Not Complied', tone: 'amber' },
    approved: { label: 'Approved', tone: 'navy' },
    as_required: { label: 'As Required', tone: 'neutral' },
};
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

function OptSelect({ label, value, onChange, options, error, placeholder = 'Not specified' }) {
    return (
        <Field label={label} error={error}>
            <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
                <option value="">{placeholder}</option>
                {options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
        </Field>
    );
}

function MishapForm({ mishap, options, onDone }) {
    const editing = Boolean(mishap);
    const { data, setData, post, put, processing, errors, reset } = useForm({
        mishap_date: mishap?.mishap_date ?? '',
        mishap_time: mishap?.mishap_time ?? '',
        location: mishap?.location ?? '',
        mishap_type: mishap?.mishap_type ?? 'incident',
        environment: mishap?.environment ?? 'ground',
        category: mishap?.category ?? '',
        aircraft: mishap?.aircraft ?? '',
        phase: mishap?.phase ?? '',
        mission: mishap?.mission ?? '',
        qualification: mishap?.qualification ?? '',
        vehicle_type: mishap?.vehicle_type ?? '',
        rank_group: mishap?.rank_group ?? '',
        description: mishap?.description ?? '',
        corrective_action: mishap?.corrective_action ?? '',
        lesson_learned: mishap?.lesson_learned ?? '',
    });

    const submit = (event) => {
        event.preventDefault();
        const opts = {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                onDone();
            },
        };

        if (editing) {
            put(`/mishaps/${mishap.id}`, opts);
        } else {
            post('/mishaps', opts);
        }
    };

    return (
        <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_0.7fr_1.6fr]">
                <Field label="Date of Mishap" error={errors.mishap_date}>
                    <input
                        type="date"
                        className="field"
                        value={data.mishap_date}
                        onChange={(e) => setData('mishap_date', e.target.value)}
                    />
                </Field>
                <Field label="Time (optional)" error={errors.mishap_time}>
                    <input
                        type="time"
                        className="field"
                        title="Philippine time. Lets the watcher check the weather at that hour, not just that day."
                        value={data.mishap_time}
                        onChange={(e) => setData('mishap_time', e.target.value)}
                    />
                </Field>
                <Field label="Location / Place" error={errors.location}>
                    <input
                        className="field"
                        placeholder="e.g. MDAAB, TOG 9, Cavite City"
                        value={data.location}
                        onChange={(e) => setData('location', e.target.value)}
                    />
                </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Mishap" error={errors.mishap_type}>
                    <select
                        className="field"
                        value={data.mishap_type}
                        onChange={(e) => setData('mishap_type', e.target.value)}
                    >
                        {options.types.map((t) => (
                            <option key={t} value={t}>
                                {cap(t)}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label="Type" error={errors.environment}>
                    <select
                        className="field"
                        value={data.environment}
                        onChange={(e) => setData('environment', e.target.value)}
                    >
                        {options.environments.map((t) => (
                            <option key={t} value={t}>
                                {cap(t)}
                            </option>
                        ))}
                    </select>
                </Field>
            </div>

            <Field label="Safety Occurrence" error={errors.category}>
                <select
                    className="field"
                    value={data.category}
                    onChange={(e) => setData('category', e.target.value)}
                >
                    <option value="">Auto-detect from description</option>
                    {options.categories.map((c) => (
                        <option key={c} value={c}>
                            {c}
                        </option>
                    ))}
                </select>
            </Field>

            {/* Deeper taxonomy — flight vs ground specifics, plus rank (both). */}
            {data.environment === 'flight' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                    <OptSelect label="Aircraft" value={data.aircraft} onChange={(v) => setData('aircraft', v)} options={options.aircraft} error={errors.aircraft} placeholder="Auto-detect from description" />
                    <OptSelect label="Phase of Flight" value={data.phase} onChange={(v) => setData('phase', v)} options={options.phases} error={errors.phase} placeholder="Auto-detect from description" />
                    <OptSelect label="Type of Mission" value={data.mission} onChange={(v) => setData('mission', v)} options={options.missions} error={errors.mission} />
                    <OptSelect label="Qualification Involved" value={data.qualification} onChange={(v) => setData('qualification', v)} options={options.qualifications} error={errors.qualification} />
                </div>
            ) : (
                <OptSelect label="Vehicle Type" value={data.vehicle_type} onChange={(v) => setData('vehicle_type', v)} options={options.vehicle_types} error={errors.vehicle_type} placeholder="Auto-detect from description" />
            )}
            <OptSelect label="Rank Involved" value={data.rank_group} onChange={(v) => setData('rank_group', v)} options={options.rank_groups} error={errors.rank_group} placeholder="Auto-detect from description" />

            <Field label="Description" error={errors.description}>
                <textarea
                    className="field min-h-28"
                    placeholder="What happened — aircraft/personnel, location detail, and outcome."
                    value={data.description}
                    onChange={(e) => setData('description', e.target.value)}
                />
            </Field>

            {/* Post-investigation fields — filled in once the investigation closes. */}
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50/60 p-4">
                <p className="label-mono !text-navy-700 mb-3">Post-Investigation (optional)</p>
                <div className="grid gap-4">
                    <Field label="Corrective Action" error={errors.corrective_action}>
                        <textarea
                            className="field min-h-20"
                            value={data.corrective_action}
                            onChange={(e) => setData('corrective_action', e.target.value)}
                        />
                    </Field>
                    <Field label="Lesson Learned" error={errors.lesson_learned}>
                        <textarea
                            className="field min-h-20"
                            value={data.lesson_learned}
                            onChange={(e) => setData('lesson_learned', e.target.value)}
                        />
                    </Field>
                </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <Button type="button" tone="ghost" onClick={onDone}>
                    Cancel
                </Button>
                <Button type="submit" tone="gold" disabled={processing}>
                    {processing ? 'Saving…' : editing ? 'Save Changes' : 'Add Mishap'}
                </Button>
            </div>
        </form>
    );
}

function Pagination({ links }) {
    if (!links || links.length <= 3) return null;

    return (
        <nav className="flex flex-wrap items-center justify-center gap-1 pt-4">
            {links.map((link, i) => (
                <button
                    key={i}
                    type="button"
                    disabled={!link.url}
                    onClick={() => link.url && router.get(link.url, {}, { preserveState: true, preserveScroll: true })}
                    className={`min-w-9 rounded-md px-3 py-1.5 font-mono text-xs transition ${
                        link.active
                            ? 'bg-navy-800 text-white'
                            : link.url
                              ? 'text-navy-700 hover:bg-slate-100'
                              : 'cursor-not-allowed text-slate-300'
                    }`}
                    dangerouslySetInnerHTML={{ __html: link.label }}
                />
            ))}
        </nav>
    );
}

export default function MishapsIndex({ mishaps, filters, focus = null, years, options }) {
    const [editing, setEditing] = useState(null); // null = closed, 'new' = create, object = edit
    const [expanded, setExpanded] = useState(focus);
    const [flash, setFlash] = useState(null);

    // Arrived from a link to one record (?focus=id): scroll to its row, open it, and highlight it briefly.
    useEffect(() => {
        if (!focus) return undefined;
        const row = document.getElementById(`mishap-${focus}`);
        if (!row) return undefined;
        setExpanded(focus);
        setFlash(focus);
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const t = setTimeout(() => setFlash(null), 4000);
        return () => clearTimeout(t);
    }, [focus]);

    const applyFilter = (patch) => {
        const next = { ...filters, ...patch };
        const query = Object.fromEntries(Object.entries(next).filter(([, v]) => v !== null && v !== ''));
        router.get('/mishaps', query, { preserveState: true, preserveScroll: true, replace: true });
    };

    const remove = (mishap) => {
        if (window.confirm(`Delete the ${mishap.display_date} record at ${mishap.location ?? 'unspecified location'}? This cannot be undone.`)) {
            router.delete(`/mishaps/${mishap.id}`, { preserveScroll: true });
        }
    };

    return (
        <>
            <Head title="Mishap Records" />

            <PageHeader
                title="Mishap Records"
                description="Log and manage every reported mishap — the accident, incident, or event classification and its ground or flight environment."
            />

            <Panel
                title={`${mishaps.total} Record${mishaps.total === 1 ? '' : 's'}`}
                action={
                    <Button tone="gold" onClick={() => setEditing('new')}>
                        + Add Mishap
                    </Button>
                }
                bodyClass="p-0"
            >
                {/* Filter bar */}
                <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 px-4 py-3">
                    <label className="block">
                        <span className="label-mono mb-1 block">Year</span>
                        <select
                            className="field !py-1.5"
                            value={filters.year ?? ''}
                            onChange={(e) => applyFilter({ year: e.target.value || null })}
                        >
                            <option value="">All years</option>
                            {years.map((y) => (
                                <option key={y} value={y}>
                                    {y}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="block">
                        <span className="label-mono mb-1 block">Mishap</span>
                        <select
                            className="field !py-1.5"
                            value={filters.type ?? ''}
                            onChange={(e) => applyFilter({ type: e.target.value || null })}
                        >
                            <option value="">All types</option>
                            {options.types.map((t) => (
                                <option key={t} value={t}>
                                    {cap(t)}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="block">
                        <span className="label-mono mb-1 block">Type</span>
                        <select
                            className="field !py-1.5"
                            value={filters.environment ?? ''}
                            onChange={(e) => applyFilter({ environment: e.target.value || null })}
                        >
                            <option value="">All</option>
                            {options.environments.map((t) => (
                                <option key={t} value={t}>
                                    {cap(t)}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="block">
                        <span className="label-mono mb-1 block">Safety Occurrence</span>
                        <select
                            className="field !py-1.5"
                            value={filters.category ?? ''}
                            onChange={(e) => applyFilter({ category: e.target.value || null })}
                        >
                            <option value="">All occurrences</option>
                            {options.categories.map((c) => (
                                <option key={c} value={c}>
                                    {c}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="block flex-1 min-w-48">
                        <span className="label-mono mb-1 block">Search</span>
                        <input
                            className="field !py-1.5"
                            placeholder="Description or location…"
                            defaultValue={filters.search ?? ''}
                            onKeyDown={(e) => e.key === 'Enter' && applyFilter({ search: e.target.value || null })}
                            onBlur={(e) => e.target.value !== (filters.search ?? '') && applyFilter({ search: e.target.value || null })}
                        />
                    </label>
                </div>

                {mishaps.data.length === 0 ? (
                    <EmptyState>No mishap records match these filters.</EmptyState>
                ) : (
                    <div className="p-2 sm:p-3">
                        <Table
                            className="[&>table]:min-w-[1400px]"
                            head={['Date', 'Location', 'Type', 'Mishap', 'Safety Occurrence', 'Description', 'Causal Factor', 'CAPS', 'Lessons Learned', '']}
                        >
                            {mishaps.data.map((m) => {
                                const open = expanded === m.id;
                                const statuses = Object.entries(m.caps_summary ?? {});
                                return (
                                    <tr
                                        key={m.id}
                                        id={`mishap-${m.id}`}
                                        className={`scroll-mt-24 align-top transition-colors duration-700 ${
                                            flash === m.id ? 'bg-gold-100 outline-2 -outline-offset-2 outline-gold-400' : focus === m.id ? 'bg-gold-50' : 'hover:bg-slate-50'
                                        }`}
                                    >
                                        <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap text-navy-800">
                                            {m.display_date}
                                            {m.mishap_time && <span className="block text-slate-400">{m.mishap_time}</span>}
                                        </td>
                                        <td className="px-3 py-2.5 text-sm text-navy-900">{m.location ?? '—'}</td>
                                        <td className="px-3 py-2.5">
                                            <Badge tone={ENV_TONE[m.environment]}>{m.environment}</Badge>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <Badge tone={TYPE_TONE[m.mishap_type]}>{m.mishap_type}</Badge>
                                        </td>
                                        <td className="px-3 py-2.5 text-xs text-slate-600">
                                            {m.category ?? '—'}
                                        </td>
                                        <td className="max-w-lg px-3 py-2.5 text-sm text-slate-600">
                                            <button
                                                type="button"
                                                className="text-left"
                                                onClick={() => setExpanded(open ? null : m.id)}
                                            >
                                                <span className={open ? '' : 'line-clamp-2'}>{m.description}</span>
                                            </button>
                                        </td>
                                        <td className="px-3 py-2.5 text-xs text-slate-600">
                                            {m.causal_factors?.length
                                                ? m.causal_factors.map((f, i) => <div key={i}>{f}</div>)
                                                : '—'}
                                        </td>
                                        <td className="min-w-56 px-3 py-2.5">
                                            <Link
                                                href={`/mishaps/${m.id}/plan`}
                                                className="label-mono !text-gold-700 hover:!text-gold-800"
                                                title="Corrective Action Plan (CAPS)"
                                            >
                                                CAPS{m.cap_count > 0 ? ` (${m.cap_count})` : ''}
                                            </Link>
                                            {open && m.cap_count > 0 && (
                                                <div className="mt-2">
                                                    <div className="flex flex-wrap gap-1">
                                                        {statuses.map(([s, n]) => (
                                                            <Badge key={s} tone={CAP_STATUS[s]?.tone ?? 'neutral'}>
                                                                {n} {CAP_STATUS[s]?.label ?? cap(s)}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                    {m.caps_open?.length > 0 && (
                                                        <ul className="mt-2 space-y-1.5">
                                                            {m.caps_open.map((c, i) => (
                                                                <li key={i} className="text-[0.7rem] leading-snug text-slate-600">
                                                                    <span className="font-semibold text-navy-800">{c.opr || 'Unassigned'}</span>
                                                                    <span className="text-slate-400"> · {CAP_STATUS[c.status]?.label ?? cap(c.status)}</span>
                                                                    {c.follow_up && <div className="text-slate-500">Follow-up: {c.follow_up}</div>}
                                                                    {c.action && <div className="text-slate-600">{c.action}</div>}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                        <td className="max-w-xs px-3 py-2.5 text-xs text-slate-600">
                                            {m.lesson_learned
                                                ? <span className={open ? '' : 'line-clamp-2'}>{m.lesson_learned}</span>
                                                : '—'}
                                        </td>
                                        <td className="px-3 py-2.5 whitespace-nowrap text-right">
                                            <button
                                                type="button"
                                                onClick={() => setEditing(m)}
                                                className="label-mono !text-navy-600 hover:!text-navy-900 px-1.5"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => remove(m)}
                                                className="label-mono !text-rose-500 hover:!text-rose-700 px-1.5"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </Table>
                        <Pagination links={mishaps.links} />
                    </div>
                )}
            </Panel>

            <Modal
                open={editing !== null}
                onClose={() => setEditing(null)}
                title={editing && editing !== 'new' ? 'Edit Mishap Record' : 'Add Mishap Record'}
            >
                {/* key forces a fresh form when switching between add and different rows */}
                {editing !== null && (
                    <MishapForm
                        key={editing === 'new' ? 'new' : editing.id}
                        mishap={editing === 'new' ? null : editing}
                        options={options}
                        onDone={() => setEditing(null)}
                    />
                )}
            </Modal>
        </>
    );
}

MishapsIndex.layout = (page) => <AppLayout>{page}</AppLayout>;
