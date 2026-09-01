import { Head, Link, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Badge, Button, EmptyState, Field, Modal, PageHeader, Panel } from '@/Components/Ui';

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const STATUS = {
    complied: { label: 'Complied', tone: 'green' },
    ongoing: { label: 'Ongoing', tone: 'sky' },
    pending: { label: 'Pending', tone: 'amber' },
    approved: { label: 'Approved', tone: 'navy' },
    as_required: { label: 'As Required', tone: 'neutral' },
};
const TYPE_TONE = { accident: 'red', incident: 'amber' };
const ENV_TONE = { flight: 'sky', ground: 'navy' };

function EntryForm({ mishapId, entry, statuses, onDone }) {
    const editing = Boolean(entry);
    const { data, setData, post, put, processing, errors, reset } = useForm({
        latent_condition: entry?.latent_condition ?? '',
        category: entry?.category ?? '',
        cause_factor: entry?.cause_factor ?? '',
        opr: entry?.opr ?? '',
        corrective_action: entry?.corrective_action ?? '',
        staff_action: entry?.staff_action ?? '',
        status: entry?.status ?? 'pending',
        remarks: entry?.remarks ?? '',
    });

    const submit = (e) => {
        e.preventDefault();
        const opts = { preserveScroll: true, onSuccess: () => { reset(); onDone(); } };
        if (editing) {
            put(`/corrective-actions/${entry.id}`, opts);
        } else {
            post(`/mishaps/${mishapId}/plan`, opts);
        }
    };

    return (
        <form onSubmit={submit} className="space-y-4">
            <Field label="Latent Condition / Gap" error={errors.latent_condition}>
                <textarea className="field min-h-16" value={data.latent_condition} onChange={(e) => setData('latent_condition', e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Category (DOTMPLF)" error={errors.category}>
                    <input className="field" placeholder="e.g. Training" value={data.category} onChange={(e) => setData('category', e.target.value)} />
                </Field>
                <Field label="Cause Factor" error={errors.cause_factor}>
                    <input className="field" placeholder="e.g. Human (Primary)" value={data.cause_factor} onChange={(e) => setData('cause_factor', e.target.value)} />
                </Field>
                <Field label="OPR / UPR" error={errors.opr}>
                    <input className="field" placeholder="e.g. 20AS" value={data.opr} onChange={(e) => setData('opr', e.target.value)} />
                </Field>
            </div>
            <Field label="Corrective Action / Milestone" error={errors.corrective_action}>
                <textarea className="field min-h-28" value={data.corrective_action} onChange={(e) => setData('corrective_action', e.target.value)} />
            </Field>
            <Field label="Staff Action" error={errors.staff_action}>
                <textarea className="field min-h-16" value={data.staff_action} onChange={(e) => setData('staff_action', e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Status" error={errors.status}>
                    <select className="field" value={data.status} onChange={(e) => setData('status', e.target.value)}>
                        {statuses.map((s) => (
                            <option key={s} value={s}>{STATUS[s]?.label ?? cap(s)}</option>
                        ))}
                    </select>
                </Field>
                <Field label="Remarks" className="sm:col-span-2" error={errors.remarks}>
                    <input className="field" placeholder="e.g. Complied dtd 04 June 2026" value={data.remarks} onChange={(e) => setData('remarks', e.target.value)} />
                </Field>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <Button type="button" tone="ghost" onClick={onDone}>Cancel</Button>
                <Button type="submit" tone="gold" disabled={processing}>
                    {processing ? 'Saving…' : editing ? 'Save Changes' : 'Add Action'}
                </Button>
            </div>
        </form>
    );
}

export default function Plan({ mishap, entries, statuses }) {
    const [editing, setEditing] = useState(null); // null | 'new' | entry

    const counts = statuses
        .map((s) => ({ s, n: entries.filter((e) => e.status === s).length }))
        .filter((x) => x.n > 0);

    const remove = (entry) => {
        if (window.confirm('Remove this corrective action?')) {
            router.delete(`/corrective-actions/${entry.id}`, { preserveScroll: true });
        }
    };

    return (
        <>
            <Head title="Corrective Action Plan" />

            <PageHeader
                title="Corrective Action Plan"
                description="Gaps, cause factors, corrective actions, responsible office, and tracked status for this mishap."
            />
            <Link href="/mishaps" className="label-mono !text-navy-600 hover:!text-navy-900 -mt-3 mb-4 inline-block">
                &larr; Back to Mishap Records
            </Link>

            {/* Mishap summary (context) */}
            <Panel title="Mishap" className="mb-5">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm text-navy-800">{mishap.display_date}</span>
                    <span className="text-sm font-medium text-navy-900">{mishap.location ?? '—'}</span>
                    <Badge tone={TYPE_TONE[mishap.mishap_type]}>{mishap.mishap_type}</Badge>
                    <Badge tone={ENV_TONE[mishap.environment]}>{mishap.environment}</Badge>
                    {mishap.cause && <span className="label-mono !text-[0.6rem]">{mishap.cause}</span>}
                </div>
                <p className="mt-2 text-sm text-slate-600">{mishap.description}</p>
            </Panel>

            <Panel
                title={`Corrective Actions (${entries.length})`}
                action={<Button tone="gold" onClick={() => setEditing('new')}>+ Add Action</Button>}
            >
                {/* Status summary */}
                {counts.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-2">
                        {counts.map(({ s, n }) => (
                            <Badge key={s} tone={STATUS[s]?.tone ?? 'neutral'}>
                                {n} {STATUS[s]?.label ?? cap(s)}
                            </Badge>
                        ))}
                    </div>
                )}

                {entries.length === 0 ? (
                    <EmptyState>No corrective actions recorded yet. Add the first one.</EmptyState>
                ) : (
                    <ol className="space-y-3">
                        {entries.map((e, i) => (
                            <li key={e.id} className="rounded-lg border border-slate-200 p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-navy-50 font-mono text-xs font-semibold text-navy-700 ring-1 ring-navy-100 ring-inset">
                                            {i + 1}
                                        </span>
                                        <Badge tone={STATUS[e.status]?.tone ?? 'neutral'}>
                                            {STATUS[e.status]?.label ?? cap(e.status)}
                                        </Badge>
                                        {e.opr && <Badge tone="navy">{e.opr}</Badge>}
                                        {e.category && <span className="label-mono !text-[0.6rem]">{e.category}</span>}
                                        {e.cause_factor && <span className="label-mono !text-[0.6rem] !text-slate-400">{e.cause_factor}</span>}
                                    </div>
                                    <div className="shrink-0">
                                        <button type="button" onClick={() => setEditing(e)} className="label-mono !text-navy-600 hover:!text-navy-900 px-1.5">Edit</button>
                                        <button type="button" onClick={() => remove(e)} className="label-mono !text-rose-500 hover:!text-rose-700 px-1.5">Delete</button>
                                    </div>
                                </div>

                                {e.latent_condition && (
                                    <p className="mt-2.5 text-xs text-slate-500">
                                        <span className="label-mono !text-[0.6rem] !text-slate-400">Gap · </span>
                                        {e.latent_condition}
                                    </p>
                                )}
                                <p className="mt-1.5 text-sm text-navy-900">{e.corrective_action}</p>
                                {e.staff_action && (
                                    <p className="mt-2 text-xs text-slate-600">
                                        <span className="label-mono !text-[0.6rem] !text-slate-400">Staff Action · </span>
                                        {e.staff_action}
                                    </p>
                                )}
                                {e.remarks && (
                                    <p className="mt-1 text-xs text-slate-500 italic">{e.remarks}</p>
                                )}
                            </li>
                        ))}
                    </ol>
                )}
            </Panel>

            <Modal
                open={editing !== null}
                onClose={() => setEditing(null)}
                title={editing && editing !== 'new' ? 'Edit Corrective Action' : 'Add Corrective Action'}
            >
                {editing !== null && (
                    <EntryForm
                        key={editing === 'new' ? 'new' : editing.id}
                        mishapId={mishap.id}
                        entry={editing === 'new' ? null : editing}
                        statuses={statuses}
                        onDone={() => setEditing(null)}
                    />
                )}
            </Modal>
        </>
    );
}

Plan.layout = (page) => <AppLayout>{page}</AppLayout>;
