import { Head, useForm } from '@inertiajs/react';
import { Button, Field } from '@/Components/Ui';
import ThemeToggle from '@/Components/ThemeToggle';

export default function Login() {
    const { data, setData, post, processing, errors } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const submit = (event) => {
        event.preventDefault();
        post('/login');
    };

    return (
        <div className="relative flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
            <Head title="Sign In" />

            <ThemeToggle className="absolute top-4 right-4" />

            <div className="w-full max-w-sm">
                <div className="mb-7 flex flex-col items-center gap-3 text-center">
                    <img
                        src="/img/safety-seal.jpg"
                        alt="15SW Safety Office seal"
                        className="h-24 w-24 rounded-full object-cover shadow-sm ring-1 ring-slate-200"
                    />
                    <div>
                        <p className="label-mono !text-gold-600 !text-[0.6rem]">
                            Republic of the Philippines · Philippine Air Force
                        </p>
                        <h1 className="font-display text-3xl leading-tight font-bold tracking-wide text-navy-900 uppercase">
                            15SW Safety
                        </h1>
                        <p className="label-mono !text-[0.6rem]">15th Strike Wing — Wing Safety Office</p>
                    </div>
                </div>

                <form onSubmit={submit} className="panel overflow-hidden">
                    <div className="space-y-4 p-6">
                        <div>
                            <h2 className="font-display text-2xl font-bold text-navy-900">Sign In</h2>
                            <p className="mt-1 text-sm text-slate-600">
                                Safety office personnel only. All access is logged.
                            </p>
                        </div>

                        <Field label="Username or Email" error={errors.email}>
                            <input
                                type="text"
                                className="field"
                                value={data.email}
                                autoComplete="username"
                                autoFocus
                                onChange={(e) => setData('email', e.target.value)}
                            />
                        </Field>

                        <Field label="Password" error={errors.password}>
                            <input
                                type="password"
                                className="field"
                                value={data.password}
                                autoComplete="current-password"
                                onChange={(e) => setData('password', e.target.value)}
                            />
                        </Field>

                        <label className="flex items-center gap-2 text-sm text-slate-600">
                            <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-slate-300 accent-navy-700"
                                checked={data.remember}
                                onChange={(e) => setData('remember', e.target.checked)}
                            />
                            Keep me signed in on this terminal
                        </label>

                        <Button type="submit" disabled={processing} className="w-full !py-2.5">
                            {processing ? 'Verifying…' : 'Sign In'}
                        </Button>
                    </div>
                </form>

                <p className="label-mono mt-6 text-center !text-[0.6rem] leading-relaxed">
                    15SW Safety · For official safety use only
                    <br />
                    Developed by the Office of the Directorate of Personnel, 15th Strike Wing
                </p>
            </div>
        </div>
    );
}
