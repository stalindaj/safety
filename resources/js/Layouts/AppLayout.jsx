import { Link, router, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import Seal from '@/Components/Seal';
import { AlertIcon, HomeIcon, LogoutIcon } from '@/Components/Icons';

const NAV = [
    { href: '/', label: 'Dashboard', icon: HomeIcon, match: (p) => p === '/' },
    { href: '/mishaps', label: 'Mishap Records', icon: AlertIcon },
];

function Clock() {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    const local = now.toLocaleTimeString('en-GB', { hour12: false, timeZone: 'Asia/Manila' });
    const zulu = now.toLocaleTimeString('en-GB', { hour12: false, timeZone: 'UTC' });

    return (
        <div className="hidden text-right sm:block">
            <p className="label-mono !text-[0.6rem]">Zulu / Local</p>
            <p className="font-mono text-sm text-navy-800 tabular-nums">
                {zulu}Z <span className="text-slate-300">|</span> {local}
            </p>
        </div>
    );
}

function Flash() {
    const { flash } = usePage().props;
    const [dismissed, setDismissed] = useState(null);
    const message = flash?.success || flash?.error;
    const isError = Boolean(flash?.error);

    useEffect(() => {
        setDismissed(null);
    }, [message]);

    if (!message || dismissed === message) return null;

    return (
        <div
            className={`mb-5 flex items-start justify-between gap-4 rounded-md border px-4 py-3 text-sm ${
                isError
                    ? 'border-rose-200 bg-rose-50 text-rose-800'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
        >
            <p>{message}</p>
            <button type="button" onClick={() => setDismissed(message)} className="label-mono shrink-0">
                Dismiss
            </button>
        </div>
    );
}

export default function AppLayout({ children }) {
    const { auth, app } = usePage().props;
    const currentPath = usePage().url.split('?')[0];

    return (
        <div className="min-h-screen bg-slate-100">
            {/* Icon rail */}
            <nav className="fixed inset-y-0 left-0 z-40 hidden w-16 flex-col items-center gap-1 border-r border-slate-200 bg-white py-4 lg:flex">
                <Seal src="/img/wing-seal.png" label="15th Strike Wing" className="mb-3 h-9 w-9" />
                {NAV.map((item) => {
                    const Icon = item.icon;
                    const active = item.match ? item.match(currentPath) : currentPath.startsWith(item.href);

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            title={item.label}
                            aria-label={item.label}
                            className={`group relative flex h-10 w-10 items-center justify-center rounded-lg transition ${
                                active
                                    ? 'bg-navy-800 text-white'
                                    : 'text-slate-400 hover:bg-slate-100 hover:text-navy-700'
                            }`}
                        >
                            <Icon />
                            <span className="pointer-events-none absolute left-12 z-50 hidden rounded bg-navy-900 px-2 py-1 font-mono text-[0.65rem] whitespace-nowrap text-white group-hover:block">
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
                <span className="mt-auto font-mono text-[0.6rem] tracking-widest text-slate-300 [writing-mode:vertical-rl]">
                    15SW · SAFETY
                </span>
            </nav>

            <div className="lg:pl-16">
                <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
                    <div className="flex items-center gap-4 px-4 py-3 sm:px-6">
                        <Seal src="/img/wing-seal.png" label="15th Strike Wing" className="h-11 w-11 shrink-0" />
                        <div className="min-w-0 flex-1">
                            <p className="label-mono !text-gold-600 !text-[0.6rem] truncate">
                                Republic of the Philippines · Philippine Air Force
                            </p>
                            <h1 className="font-display truncate text-lg leading-tight font-bold tracking-wide text-navy-900 uppercase sm:text-xl">
                                15SW Safety
                            </h1>
                            <p className="label-mono !text-[0.6rem] truncate">{app?.unit}</p>
                        </div>

                        <div className="hidden text-right md:block">
                            <p className="label-mono !text-[0.6rem]">System Status</p>
                            <p className="flex items-center justify-end gap-1.5 font-mono text-sm text-navy-800">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                Operational
                            </p>
                        </div>

                        <Clock />

                        <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
                            <Link href="/account" className="group text-right" title="Account & password">
                                <p className="label-mono !text-[0.6rem]">User</p>
                                <p className="font-mono text-sm text-navy-800 group-hover:text-navy-600">
                                    {auth?.user?.display_name}
                                </p>
                            </Link>
                            <button
                                type="button"
                                title="Sign out"
                                onClick={() => router.post('/logout')}
                                className="rounded-md p-2 text-slate-400 transition hover:bg-slate-100 hover:text-rose-600"
                            >
                                <LogoutIcon />
                            </button>
                        </div>
                    </div>

                    {/* Compact nav for small screens */}
                    <div className="flex gap-1 overflow-x-auto border-t border-slate-100 px-3 py-1.5 lg:hidden">
                        {NAV.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="label-mono shrink-0 rounded px-2 py-1 hover:bg-slate-100"
                            >
                                {item.label}
                            </Link>
                        ))}
                    </div>
                </header>

                <main className="mx-auto max-w-[1600px] px-4 py-7 sm:px-6">
                    <Flash />
                    {children}
                </main>

                <footer className="label-mono !text-[0.6rem] px-6 py-6 text-center">
                    15SW Safety v1.0 · For official safety use only · 15th Strike Wing, Philippine Air Force
                </footer>
            </div>
        </div>
    );
}
