import { Link, router, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import ThemeToggle from '@/Components/ThemeToggle';
import { AlertIcon, HomeIcon, LogoutIcon, UserIcon } from '@/Components/Icons';

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

    return (
        <p className="hidden items-baseline gap-1.5 font-mono text-sm text-navy-800 tabular-nums lg:flex" title="Philippine time">
            {local}
            <span className="label-mono !text-[0.58rem]">PHT</span>
        </p>
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
            className={`mb-5 flex items-start justify-between gap-4 rounded-lg border px-4 py-3 text-sm ${
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

function NavLinks({ currentPath, compact = false }) {
    return NAV.map((item) => {
        const Icon = item.icon;
        const active = item.match ? item.match(currentPath) : currentPath.startsWith(item.href);

        return (
            <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    active ? 'bg-navy-800 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-navy-900'
                }`}
            >
                {!compact && <Icon className="h-4 w-4" />}
                {item.label}
            </Link>
        );
    });
}

export default function AppLayout({ children }) {
    const { auth, app } = usePage().props;
    const currentPath = usePage().url.split('?')[0];

    return (
        <div className="min-h-screen bg-slate-100">
            <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
                <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-2.5 sm:gap-6 sm:px-6">
                    <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="15SW Safety — Dashboard">
                        <img
                            src="/img/safety-seal.jpg"
                            alt=""
                            className="h-9 w-9 rounded-full object-cover ring-1 ring-slate-200"
                        />
                        <span className="leading-tight">
                            <span className="font-display block text-lg font-bold tracking-wide text-navy-900 uppercase">
                                15SW Safety
                            </span>
                            <span className="label-mono hidden !text-[0.58rem] sm:block">
                                {app?.unit ?? 'Wing Safety Office'}
                            </span>
                        </span>
                    </Link>

                    <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
                        <NavLinks currentPath={currentPath} />
                    </nav>

                    <div className="ml-auto flex items-center gap-1 sm:gap-2">
                        <Clock />
                        <ThemeToggle />
                        <Link
                            href="/account"
                            title="Account & password"
                            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-navy-800 transition hover:bg-slate-100"
                        >
                            <UserIcon className="h-5 w-5 text-slate-500" />
                            <span className="hidden font-mono sm:inline">{auth?.user?.display_name}</span>
                        </Link>
                        <button
                            type="button"
                            title="Sign out"
                            aria-label="Sign out"
                            onClick={() => router.post('/logout')}
                            className="rounded-lg p-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
                        >
                            <LogoutIcon />
                        </button>
                    </div>
                </div>

                {/* Small screens: the nav moves to its own row. */}
                <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-3 py-1.5 md:hidden" aria-label="Main">
                    <NavLinks currentPath={currentPath} compact />
                </nav>
            </header>

            <main className="mx-auto max-w-[1600px] px-4 py-7 sm:px-6">
                <Flash />
                {children}
            </main>

            <footer className="label-mono !text-[0.6rem] px-6 pt-2 pb-8 text-center leading-relaxed">
                15SW Safety · For official safety use only · 15th Strike Wing, Philippine Air Force
                <br />
                Developed by the Office of the Directorate of Personnel, 15th Strike Wing
            </footer>
        </div>
    );
}
