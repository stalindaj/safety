import { Head, Link, router, useForm } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
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
const TYPE_TONE = { accident: 'red', incident: 'amber', event: 'neutral' };
const ENV_TONE = { flight: 'sky', ground: 'navy' };

// Phone photos run 3–8 MB. Shrink to ≤1600px JPEG in the browser so uploads stay
// small and well under the host's upload limit.
const MAX_EDGE = 1600;
async function shrinkPhoto(file) {
    if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
    try {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close?.();
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
        if (!blob || blob.size >= file.size) return file;
        return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' });
    } catch {
        return file; // e.g. a format this browser can't decode — let the server decide.
    }
}

function Thumb({ src, alt, onRemove }) {
    return (
        <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-slate-100 ring-1 ring-slate-200">
            <img src={src} alt={alt} className="h-full w-full object-cover" />
            <button
                type="button"
                onClick={onRemove}
                className="absolute top-1.5 right-1.5 rounded bg-white/95 px-1.5 py-0.5 font-mono text-[0.6rem] tracking-wide text-rose-600 uppercase shadow-sm ring-1 ring-rose-200 hover:bg-white"
            >
                Remove
            </button>
        </div>
    );
}

function EntryForm({ mishapId, entry, statuses, maxProofs, onDone }) {
    const editing = Boolean(entry);
    const existing = entry?.proofs ?? [];
    const { data, setData, post, transform, processing, errors, reset } = useForm({
        latent_condition: entry?.latent_condition ?? '',
        category: entry?.category ?? '',
        cause_factor: entry?.cause_factor ?? '',
        opr: entry?.opr ?? '',
        follow_up_name: entry?.follow_up_name ?? '',
        follow_up_contact: entry?.follow_up_contact ?? '',
        follow_up_email: entry?.follow_up_email ?? '',
        corrective_action: entry?.corrective_action ?? '',
        staff_action: entry?.staff_action ?? '',
        intervention: entry?.intervention ?? '',
        photos: [], // new files to upload
        remove_photos: [], // ids of saved photos to drop
        status: entry?.status ?? 'pending',
        remarks: entry?.remarks ?? '',
    });
    const [preparing, setPreparing] = useState(false);

    const kept = existing.filter((p) => !data.remove_photos.includes(p.id));
    const photoCount = kept.length + data.photos.length;
    const canComply = photoCount > 0;
    const room = maxProofs - photoCount;

    const previews = useMemo(() => data.photos.map((f) => URL.createObjectURL(f)), [data.photos]);
    useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

    const addPhotos = async (e) => {
        const picked = Array.from(e.target.files ?? []).slice(0, room);
        e.target.value = '';
        if (!picked.length) return;
        setPreparing(true);
        const shrunk = await Promise.all(picked.map(shrinkPhoto));
        setPreparing(false);
        setData((d) => ({ ...d, photos: [...d.photos, ...shrunk].slice(0, maxProofs) }));
    };

    const photoErrors = Object.entries(errors)
        .filter(([k]) => k === 'photos' || k.startsWith('photos.'))
        .map(([, v]) => v);
    const statusError = errors.status
        ?? (data.status === 'complied' && !canComply ? 'Attach at least one proof photo to mark this Complied.' : null);

    const submit = (e) => {
        e.preventDefault();
        const opts = { preserveScroll: true, forceFormData: true, onSuccess: () => { reset(); onDone(); } };
        if (editing) {
            // Files can't ride on a real PUT in PHP, so spoof it over POST.
            transform((d) => ({ ...d, _method: 'put' }));
            post(`/corrective-actions/${entry.id}`, opts);
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

            <fieldset className="rounded-lg border border-slate-200 px-4 pt-2 pb-4">
                <legend className="label-mono !text-navy-800 px-1 font-semibold">Follow-up person</legend>
                <p className="mb-3 text-xs text-slate-500">The person in the OPR/UPR who answers for this action until it's complied.</p>
                <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Rank and name" error={errors.follow_up_name}>
                        <input className="field" placeholder="e.g. SSgt Juan Dela Cruz" value={data.follow_up_name} onChange={(e) => setData('follow_up_name', e.target.value)} />
                    </Field>
                    <Field label="Contact number" error={errors.follow_up_contact}>
                        <input className="field" type="tel" inputMode="tel" placeholder="e.g. 0917 123 4567" value={data.follow_up_contact} onChange={(e) => setData('follow_up_contact', e.target.value)} />
                    </Field>
                    <Field label="Email" error={errors.follow_up_email}>
                        <input className="field" type="email" placeholder="name@example.com" value={data.follow_up_email} onChange={(e) => setData('follow_up_email', e.target.value)} />
                    </Field>
                </div>
            </fieldset>

            <Field label="Corrective Action / Milestone" error={errors.corrective_action}>
                <textarea className="field min-h-28" value={data.corrective_action} onChange={(e) => setData('corrective_action', e.target.value)} />
            </Field>
            <Field label="Staff Action" error={errors.staff_action}>
                <textarea className="field min-h-16" placeholder="e.g. Conduct a wing safety seminar on hazard identification" value={data.staff_action} onChange={(e) => setData('staff_action', e.target.value)} />
            </Field>

            <fieldset className="rounded-lg border border-slate-200 px-4 pt-2 pb-4">
                <legend className="label-mono !text-navy-800 px-1 font-semibold">Proof / Intervention</legend>
                <p className="mb-3 text-xs text-slate-500">What was actually done, with up to {maxProofs} photos as proof. Complied is only allowed once a photo is attached.</p>
                <Field label="What was done" error={errors.intervention}>
                    <textarea className="field min-h-16" placeholder="e.g. Safety seminar held 12 Sep 2026 at the Wing conference room, 45 attendees" value={data.intervention} onChange={(e) => setData('intervention', e.target.value)} />
                </Field>
                <div className="mt-4">
                    <span className="label-mono mb-1.5 block">Photos ({photoCount} of {maxProofs})</span>
                    <div className="grid grid-cols-3 gap-3">
                        {kept.map((p) => (
                            <Thumb
                                key={`saved-${p.id}`}
                                src={p.url}
                                alt={p.name ?? 'Proof photo'}
                                onRemove={() => setData('remove_photos', [...data.remove_photos, p.id])}
                            />
                        ))}
                        {data.photos.map((f, i) => (
                            <Thumb
                                key={`new-${i}-${f.name}`}
                                src={previews[i]}
                                alt={f.name}
                                onRemove={() => setData('photos', data.photos.filter((_, j) => j !== i))}
                            />
                        ))}
                        {Array.from({ length: Math.max(room, 0) }).map((_, i) =>
                            i === 0 ? (
                                <label
                                    key="add"
                                    className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-slate-300 text-center transition hover:border-gold-400 hover:bg-gold-50 focus-within:border-gold-500"
                                >
                                    <span className="text-2xl leading-none text-slate-400">+</span>
                                    <span className="label-mono">{preparing ? 'Preparing…' : 'Add photo'}</span>
                                    <input type="file" accept="image/*" multiple className="sr-only" onChange={addPhotos} disabled={preparing} />
                                </label>
                            ) : (
                                <div key={`empty-${i}`} className="aspect-[4/3] rounded-md border border-dashed border-slate-200 bg-slate-50" />
                            ),
                        )}
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500">e.g. seminar photo, attendance sheet, signed memo. Large photos are shrunk before upload.</p>
                    {photoErrors.map((msg, i) => (
                        <span key={i} className="mt-1 block text-xs text-rose-600">{msg}</span>
                    ))}
                </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Status" error={statusError}>
                    <select className="field" value={data.status} onChange={(e) => setData('status', e.target.value)}>
                        {statuses.map((s) => (
                            <option key={s} value={s} disabled={s === 'complied' && !canComply}>
                                {`${STATUS[s]?.label ?? cap(s)}${s === 'complied' && !canComply ? ' (needs a proof photo)' : ''}`}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label="Remarks" className="sm:col-span-2" error={errors.remarks}>
                    <input className="field" placeholder="e.g. Complied dtd 04 June 2026" value={data.remarks} onChange={(e) => setData('remarks', e.target.value)} />
                </Field>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <Button type="button" tone="ghost" onClick={onDone}>Cancel</Button>
                <Button type="submit" tone="gold" disabled={processing || preparing}>
                    {processing ? 'Saving…' : editing ? 'Save Changes' : 'Add Action'}
                </Button>
            </div>
        </form>
    );
}

export default function Plan({ mishap, entries, statuses, max_proofs: maxProofs = 3 }) {
    const [editing, setEditing] = useState(null); // null | 'new' | entry

    const counts = statuses
        .map((s) => ({ s, n: entries.filter((e) => e.status === s).length }))
        .filter((x) => x.n > 0);
    const compliedNoProof = entries.filter((e) => e.status === 'complied' && e.proofs.length === 0).length;

    const remove = (entry) => {
        if (window.confirm('Remove this corrective action and its proof photos?')) {
            router.delete(`/corrective-actions/${entry.id}`, { preserveScroll: true });
        }
    };

    return (
        <>
            <Head title="CAPS — Corrective Action Plan" />

            <PageHeader
                title="CAPS"
                description="Corrective Action Plan — gaps, cause factors, corrective actions, who follows them up, proof of compliance, and tracked status for this mishap."
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
                    {mishap.category && <span className="label-mono !text-[0.6rem]">{mishap.category}</span>}
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
                        {compliedNoProof > 0 && (
                            <Badge tone="amber">{compliedNoProof} complied without proof</Badge>
                        )}
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
                                        {e.status === 'complied' && e.proofs.length === 0 && (
                                            <Badge tone="amber">No proof on file</Badge>
                                        )}
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
                                {(e.follow_up_name || e.follow_up_contact || e.follow_up_email) && (
                                    <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-slate-600">
                                        <span className="label-mono !text-[0.6rem] !text-slate-400">Follow-up ·</span>
                                        {e.follow_up_name && <span className="font-medium text-navy-900">{e.follow_up_name}</span>}
                                        {e.follow_up_contact && (
                                            <a href={`tel:${e.follow_up_contact.replace(/[^0-9+]/g, '')}`} className="font-mono text-navy-700 hover:underline">
                                                {e.follow_up_contact}
                                            </a>
                                        )}
                                        {e.follow_up_email && (
                                            <a href={`mailto:${e.follow_up_email}`} className="text-navy-700 hover:underline">{e.follow_up_email}</a>
                                        )}
                                    </p>
                                )}
                                {(e.intervention || e.proofs.length > 0) && (
                                    <div className="mt-3 rounded-md bg-slate-50 p-3 ring-1 ring-slate-100 ring-inset">
                                        <p className="label-mono !text-[0.6rem] !text-slate-500">Proof / Intervention</p>
                                        {e.intervention && <p className="mt-1 text-xs text-slate-700">{e.intervention}</p>}
                                        {e.proofs.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {e.proofs.map((p) => (
                                                    <a
                                                        key={p.id}
                                                        href={p.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="block h-16 w-24 overflow-hidden rounded ring-1 ring-slate-200 transition hover:ring-gold-400"
                                                        title="Open full photo"
                                                    >
                                                        <img src={p.url} alt={p.name ?? 'Proof photo'} loading="lazy" className="h-full w-full object-cover" />
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                                {e.remarks && (
                                    <p className="mt-2 text-xs text-slate-500 italic">{e.remarks}</p>
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
                        maxProofs={maxProofs}
                        onDone={() => setEditing(null)}
                    />
                )}
            </Modal>
        </>
    );
}

Plan.layout = (page) => <AppLayout>{page}</AppLayout>;
