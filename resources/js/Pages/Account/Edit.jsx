import { Head, useForm } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Button, Field, PageHeader, Panel } from '@/Components/Ui';

export default function AccountEdit({ account }) {
    const { data, setData, put, processing, errors, reset } = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const submit = (event) => {
        event.preventDefault();
        put('/account/password', {
            preserveScroll: true,
            onSuccess: () => reset(),
        });
    };

    return (
        <>
            <Head title="Account" />

            <PageHeader
                title="Account"
                description="Your sign-in details and password."
            />

            <div className="grid gap-5 lg:grid-cols-2">
                <Panel title="Profile">
                    <dl className="divide-y divide-slate-100 text-sm">
                        {[
                            ['Name', [account.rank, account.name].filter(Boolean).join(' ')],
                            ['Email', account.email],
                            ['Role', account.role],
                        ].map(([label, value]) => (
                            <div key={label} className="flex justify-between gap-4 py-2.5">
                                <dt className="label-mono">{label}</dt>
                                <dd className="text-navy-900">{value || '—'}</dd>
                            </div>
                        ))}
                    </dl>
                </Panel>

                <Panel title="Change Password">
                    <form onSubmit={submit} className="space-y-4">
                        <Field label="Current Password" error={errors.current_password}>
                            <input
                                type="password"
                                className="field"
                                autoComplete="current-password"
                                value={data.current_password}
                                onChange={(e) => setData('current_password', e.target.value)}
                            />
                        </Field>
                        <Field label="New Password" error={errors.password}>
                            <input
                                type="password"
                                className="field"
                                autoComplete="new-password"
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                            />
                        </Field>
                        <Field label="Confirm New Password" error={errors.password_confirmation}>
                            <input
                                type="password"
                                className="field"
                                autoComplete="new-password"
                                value={data.password_confirmation}
                                onChange={(e) => setData('password_confirmation', e.target.value)}
                            />
                        </Field>
                        <p className="text-xs text-slate-500">At least 8 characters.</p>
                        <div className="flex justify-end border-t border-slate-200 pt-4">
                            <Button type="submit" tone="gold" disabled={processing}>
                                {processing ? 'Saving…' : 'Update Password'}
                            </Button>
                        </div>
                    </form>
                </Panel>
            </div>
        </>
    );
}

AccountEdit.layout = (page) => <AppLayout>{page}</AppLayout>;
