import { Head } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import WeeklyForecastPanel from '@/Components/WeeklyForecastPanel';
import SpiPanel from '@/Components/SpiPanel';
import EarlyWarningPanel from '@/Components/EarlyWarningPanel';

/*
 * Everything forward-looking in one place: the weekly base rate from the
 * Colab notebook, the SPI, and the experimental Predictive Safety Forecast
 * under it. The dashboard stays on analytics of what has happened.
 */
export default function Forecast({ records, years, today, risk_forecasts: riskForecasts = [], spi = null, early_warning: earlyWarning = null }) {
    return (
        <>
            <Head title="Safety Forecast" />

            <div className="mb-5">
                <p className="label-mono !text-gold-600">Wing Safety Forecast</p>
                <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-navy-900">Safety Forecast</h1>
                <p className="mt-1 text-sm text-slate-600">What to watch this week: the Wing's normal chance, the current safety level, and signals from outside.</p>
            </div>

            <WeeklyForecastPanel records={records} years={years} today={today} forecasts={riskForecasts} />
            <SpiPanel spi={spi} />
            <EarlyWarningPanel data={earlyWarning} />
        </>
    );
}

Forecast.layout = (page) => <AppLayout>{page}</AppLayout>;
