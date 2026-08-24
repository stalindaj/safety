import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Badge, Button, EmptyState, Field, Modal, PageHeader, Panel, Table } from '@/Components/Ui';

const TYPE_TONE = { accident: 'red', incident: 'amber' };
const ENV_TONE = { flight: 'sky', ground: 'navy' };
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

function MishapForm({ mishap, options, onDone }) {
    const editing = Boolean(mishap);
    const { data, setData, post, put, processing, errors, reset } = useForm({
        mishap_date: mishap?.mishap_date ?? '',
        location: mishap?.location ?? '',
        mishap_type: mishap?.mishap_type ?? 'incident',
        environment: mishap?.environment ?? 'ground',
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
            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Date of Mishap" error={errors.mishap_date}>
                    <input
                        type="date"
                        className="field"
                        value={data.mishap_date}
                        onChange={(e) => setData('mishap_date', e.target.value)}
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
                <Field label="Classification" error={errors.mishap_type}>
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
                <Field label="Environment" error={errors.environment}>
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

            <Field label="Description" error={errors.description}>
                <textarea
                    className="field min-h-28"
                    placeholder="What happened — aircraft/personnel, location detail, and outcome."
                    value={data.description}
                    onChange={(e) => setData('description', e.target.value)}
                />
            </Field>

            {/* Post-investigation fields. AI drafting is planned — the button is a
                placeholder until the generator is wired up. */}
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50/60 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="label-mono !text-navy-700">Post-Investigation (optional)</p>
                    <button
                        type="button"
                        disabled
                        title="AI generation is planned for a future release"
                        className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md bg-white px-2.5 py-1 font-mono text-[0.65rem] tracking-wide text-slate-400 uppercase ring-1 ring-slate-200 ring-inset"
                    >
                        ✨ Generate with AI · Soon
                    </button>
                </div>
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

export default function MishapsIndex({ mishaps, filters, years, options }) {
    const [editing, setEditing] = useState(null); // null = closed, 'new' = create, object = edit
    const [expanded, setExpanded] = useState(null);

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
                description="Log and manage every reported mishap — the accident/incident classification and its ground or flight environment."
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
                        <span className="label-mono mb-1 block">Classification</span>
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
                        <span className="label-mono mb-1 block">Environment</span>
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
                        <Table head={['Date', 'Location', 'Type', 'Environment', 'Description', '']}>
                            {mishaps.data.map((m) => (
                                <tr key={m.id} className="align-top hover:bg-slate-50">
                                    <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap text-navy-800">
                                        {m.display_date}
                                    </td>
                                    <td className="px-3 py-2.5 text-sm text-navy-900">{m.location ?? '—'}</td>
                                    <td className="px-3 py-2.5">
                                        <Badge tone={TYPE_TONE[m.mishap_type]}>{m.mishap_type}</Badge>
                                    </td>
                                    <td className="px-3 py-2.5">
                                        <Badge tone={ENV_TONE[m.environment]}>{m.environment}</Badge>
                                    </td>
                                    <td className="max-w-md px-3 py-2.5 text-sm text-slate-600">
                                        <button
                                            type="button"
                                            className="text-left"
                                            onClick={() => setExpanded(expanded === m.id ? null : m.id)}
                                        >
                                            <span className={expanded === m.id ? '' : 'line-clamp-2'}>{m.description}</span>
                                        </button>
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
                            ))}
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
