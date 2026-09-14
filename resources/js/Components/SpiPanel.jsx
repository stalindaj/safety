import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Panel } from '@/Components/Ui';

// Chart colours are theme variables, so they follow light / dark mode.
const NAVY = 'var(--color-navy-600)';
const axis = { fontSize: 11, fontFamily: 'IBM Plex Mono, monospace', fill: 'var(--color-slate-500)' };
const tip = {
    borderRadius: 8, border: '1px solid var(--color-slate-200)', fontSize: 12,
    background: 'var(--color-white)', color: 'var(--color-navy-900)',
    fontFamily: 'IBM Plex Mono, monospace', boxShadow: '0 4px 12px rgb(15 23 42 / 0.08)',
};

/* Safety Performance Indicator — ICAO Doc 9859 §4.4.5 style trigger levels.
   Detects an abnormal rate; it does not predict individual events. */
const SPI_STATUS = {
    normal: { label: 'Normal', tile: 'bg-emerald-50 ring-emerald-100', text: 'text-emerald-700' },
    caution: { label: 'Caution', tile: 'bg-amber-50 ring-amber-100', text: 'text-amber-700' },
    alert: { label: 'Alert', tile: 'bg-orange-50 ring-orange-100', text: 'text-orange-700' },
    critical: { label: 'Critical', tile: 'bg-rose-50 ring-rose-100', text: 'text-rose-700' },
};
export default function SpiPanel({ spi }) {
    if (!spi || !spi.series?.length) return null;
    const st = SPI_STATUS[spi.status] ?? SPI_STATUS.normal;
    const L = spi.levels;
    return (
        <Panel title={`Safety Performance Indicator — rolling ${spi.window_days}-day mishap count`} className="mb-5">
            <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
                <div className={`self-start rounded-lg p-4 text-center ring-1 ring-inset ${st.tile}`}>
                    <p className="label-mono !text-[0.6rem]">Current status</p>
                    <p className={`font-display mt-1 text-3xl font-bold ${st.text}`}>{st.label}</p>
                    <p className="mt-1 text-xs text-slate-600">
                        {spi.current} mishap{spi.current === 1 ? '' : 's'} in the last {spi.window_days} days
                    </p>
                    <div className="mt-3 space-y-0.5 border-t border-white/60 pt-2 text-left font-mono text-[0.65rem] text-slate-600">
                        <p>normal (mean) · {L.mean}</p>
                        <p>caution +1σ · {L.caution}</p>
                        <p className="text-orange-700">alert +2σ · {L.alert}</p>
                        <p className="text-rose-700">critical +3σ · {L.critical}</p>
                    </div>
                </div>

                <div className="min-w-0">
                    <p className="mb-2 text-sm text-slate-600">
                        Trigger levels are the historical mean ({spi.mean}) plus multiples of the standard
                        deviation ({spi.sd}) — the method ICAO prescribes for safety triggers.
                    </p>
                    <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={spi.series} margin={{ top: 8, right: 16, bottom: 4, left: -20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-slate-200)" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    tick={axis}
                                    tickLine={false}
                                    axisLine={{ stroke: 'var(--color-slate-200)' }}
                                    interval={Math.ceil(spi.series.length / 8)}
                                    tickFormatter={(d) => String(d).slice(0, 7)}
                                />
                                <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                                <Tooltip contentStyle={tip} formatter={(v) => [`${v} mishaps`, `${spi.window_days}-day count`]} />
                                <ReferenceLine y={L.mean} stroke="var(--color-slate-400)" strokeDasharray="4 4" />
                                <ReferenceLine y={L.alert} stroke="#ea7317" strokeDasharray="6 3" />
                                <ReferenceLine y={L.critical} stroke="#e11d48" strokeDasharray="6 3" />
                                <Line type="monotone" dataKey="value" stroke={NAVY} strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {spi.breaches?.length > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-3">
                    <p className="label-mono mb-2 !text-[0.6rem]">Periods that breached the alert level</p>
                    <ul className="flex flex-wrap gap-2">
                        {spi.breaches.map((b, i) => (
                            <li key={i} className="rounded-md bg-orange-50 px-2.5 py-1 text-xs text-orange-900 ring-1 ring-orange-200 ring-inset">
                                {b.from} → {b.to} · peak {b.peak}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <p className="label-mono mt-3 !text-[0.55rem] !text-slate-400">
                Method: ICAO Doc 9859 (SMM 4th ed) §4.4.5 — trigger levels from the population standard
                deviation of preceding data points. Detects abnormal rates; does not predict individual events.
            </p>
        </Panel>
    );
}

/* A titled list of proportional bars with an auto-generated insight line. */
