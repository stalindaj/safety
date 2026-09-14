import { Head } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { EmptyState, Panel } from '@/Components/Ui';
import CapsOverview from '@/Components/CapsOverview';

/* CAPS follow-through: each year's mishaps with their corrective actions, and the same actions by unit. */
export default function Caps({ caps = [], current_year: currentYear }) {
    return (
        <>
            <Head title="Corrective Actions (CAPS)" />

            <div className="mb-5">
                <p className="label-mono !text-gold-600">Wing Safety Follow-through</p>
                <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-navy-900">Corrective Actions (CAPS)</h1>
                <p className="mt-1 text-sm text-slate-600">The board's recommendations for each mishap, who owns them, and whether they're complied, with proof.</p>
            </div>

            {caps.length ? (
                <CapsOverview mishaps={caps} currentYear={currentYear} />
            ) : (
                <Panel><EmptyState>No mishap records yet.</EmptyState></Panel>
            )}
        </>
    );
}

Caps.layout = (page) => <AppLayout>{page}</AppLayout>;
