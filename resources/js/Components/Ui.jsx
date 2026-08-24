import { Link } from '@inertiajs/react';
import { useEffect } from 'react';

export function Panel({ title, action, children, className = '', bodyClass = 'p-5' }) {
    return (
        <section className={`panel ${className}`}>
            {(title || action) && (
                <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-3.5">
                    {title && (
                        <h2 className="flex items-center gap-2.5">
                            <span className="h-4 w-1 rounded-full bg-gold-400" />
                            <span className="label-mono !text-navy-800 !text-[0.72rem] font-semibold">{title}</span>
                        </h2>
                    )}
                    {action}
                </header>
            )}
            <div className={bodyClass}>{children}</div>
        </section>
    );
}

export function PageHeader({ module, title, description, back = true }) {
    return (
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
                {module && <p className="label-mono !text-gold-600 mb-1.5">Module {module}</p>}
                <h1 className="font-display text-3xl font-bold tracking-tight text-navy-900 sm:text-[2rem]">
                    {title}
                </h1>
                {description && <p className="mt-1.5 max-w-2xl text-sm text-slate-600">{description}</p>}
            </div>
            {back && (
                <Link
                    href="/"
                    className="label-mono !text-navy-600 hover:!text-navy-900 shrink-0 pt-1 transition"
                >
                    &larr; Back to Overview
                </Link>
            )}
        </div>
    );
}

const badgeTones = {
    neutral: 'bg-slate-100 text-slate-600 ring-slate-200',
    navy: 'bg-navy-50 text-navy-700 ring-navy-200',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    red: 'bg-rose-50 text-rose-700 ring-rose-200',
    sky: 'bg-sky-50 text-sky-700 ring-sky-200',
    gold: 'bg-gold-50 text-gold-700 ring-gold-200',
};

export function Badge({ tone = 'neutral', children, className = '' }) {
    return (
        <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[0.68rem] tracking-wide uppercase ring-1 ring-inset ${badgeTones[tone] ?? badgeTones.neutral} ${className}`}
        >
            {children}
        </span>
    );
}

export function StatTile({ label, value, tone = 'navy', hint }) {
    const tones = {
        navy: 'text-navy-800',
        gold: 'text-gold-600',
        green: 'text-emerald-600',
        red: 'text-rose-600',
        sky: 'text-sky-600',
    };

    return (
        <div className="panel px-5 py-4">
            <p className={`font-display text-3xl leading-none font-bold ${tones[tone] ?? tones.navy}`}>{value}</p>
            <p className="label-mono mt-2">{label}</p>
            {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>
    );
}

const buttonTones = {
    primary: 'bg-navy-800 text-white hover:bg-navy-900 focus-visible:outline-navy-800',
    gold: 'bg-gold-400 text-navy-950 font-semibold hover:bg-gold-500 focus-visible:outline-gold-500',
    ghost: 'bg-white text-navy-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus-visible:outline-navy-500',
    danger: 'bg-white text-rose-600 ring-1 ring-inset ring-rose-200 hover:bg-rose-50 focus-visible:outline-rose-500',
};

export function Button({ tone = 'primary', className = '', as, children, ...props }) {
    const classes = `inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 font-mono text-[0.72rem] tracking-[0.08em] uppercase transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 ${buttonTones[tone] ?? buttonTones.primary} ${className}`;

    if (as === 'link') {
        return (
            <Link className={classes} {...props}>
                {children}
            </Link>
        );
    }

    return (
        <button className={classes} {...props}>
            {children}
        </button>
    );
}

export function Field({ label, error, children, className = '' }) {
    return (
        <label className={`block ${className}`}>
            <span className="label-mono mb-1.5 block">{label}</span>
            {children}
            {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
        </label>
    );
}

export function EmptyState({ children }) {
    return (
        <div className="flex min-h-32 items-center justify-center px-6 py-10 text-center text-sm text-slate-500">
            {children}
        </div>
    );
}

export function Table({ head, children, className = '' }) {
    return (
        <div className={`overflow-x-auto ${className}`}>
            <table className="w-full min-w-full text-left text-sm">
                <thead>
                    <tr className="border-b border-slate-200">
                        {head.map((cell, i) => (
                            <th key={i} scope="col" className="label-mono px-3 py-2.5 font-medium whitespace-nowrap">
                                {cell}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">{children}</tbody>
            </table>
        </div>
    );
}

export function Modal({ open, onClose, title, children, width = 'max-w-2xl' }) {
    useEffect(() => {
        if (!open) return undefined;

        const onKey = (event) => event.key === 'Escape' && onClose();
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
        };
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy-950/40 p-4 sm:p-8">
            <div className={`panel w-full ${width} my-auto`}>
                <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
                    <h2 className="flex items-center gap-2.5">
                        <span className="h-4 w-1 rounded-full bg-gold-400" />
                        <span className="label-mono !text-navy-800 !text-[0.72rem] font-semibold">{title}</span>
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="label-mono hover:!text-navy-800 transition"
                    >
                        Close &times;
                    </button>
                </header>
                <div className="p-5">{children}</div>
            </div>
        </div>
    );
}
