import { useState } from 'react';

/**
 * Unit seal. Drop the real artwork in public/img/ (wing-seal.png,
 * squadron-seal.png) and it replaces the placeholder roundel automatically.
 */
export default function Seal({ src, label, className = 'h-11 w-11' }) {
    const [failed, setFailed] = useState(false);

    if (!failed && src) {
        return (
            <img
                src={src}
                alt={label}
                className={`${className} object-contain`}
                onError={() => setFailed(true)}
            />
        );
    }

    return (
        <svg viewBox="0 0 64 64" className={className} role="img" aria-label={label}>
            <circle cx="32" cy="32" r="30" fill="#172554" />
            <circle cx="32" cy="32" r="26" fill="none" stroke="#facc15" strokeWidth="1.5" />
            <circle cx="32" cy="32" r="20" fill="#2563eb" />
            <path d="M32 16 20 40h24z" fill="#facc15" opacity="0.9" />
            <path d="M32 24 26 38h12z" fill="#172554" />
            <circle cx="32" cy="32" r="30" fill="none" stroke="#0f1836" strokeWidth="2" />
        </svg>
    );
}
