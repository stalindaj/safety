import { useState } from 'react';
import { MoonIcon, SunIcon } from '@/Components/Icons';

/**
 * Light / dark switch. The choice is saved in this browser; until someone
 * picks, the device setting decides (see the inline script in app.blade.php).
 */
export default function ThemeToggle({ className = '' }) {
    const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));

    const toggle = () => {
        const next = !dark;
        document.documentElement.classList.toggle('dark', next);
        try {
            localStorage.setItem('theme', next ? 'dark' : 'light');
        } catch {
            // Storage blocked (private mode) — the switch still works for this visit.
        }
        setDark(next);
    };

    const label = dark ? 'Switch to light mode' : 'Switch to dark mode';

    return (
        <button
            type="button"
            onClick={toggle}
            title={label}
            aria-label={label}
            aria-pressed={dark}
            className={`rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-navy-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500 ${className}`}
        >
            {dark ? <SunIcon /> : <MoonIcon />}
        </button>
    );
}
