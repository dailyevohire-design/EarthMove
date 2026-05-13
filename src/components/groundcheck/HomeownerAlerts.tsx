/**
 * Groundcheck HomeownerAlerts
 *
 * Server component that renders homeowner-facing alerts above the trust
 * report on /trust/[slug]. Reads compute_homeowner_alerts_v2()
 * (mig 247+248+249). Returns null when there are no alerts so the page
 * is unchanged for clean contractors.
 *
 * Two exports:
 *   HomeownerAlerts       async server component — fetches + renders
 *   HomeownerAlertsView   pure presentational — takes alerts array,
 *                         renders. Smoke-tested in isolation.
 */
import { createClient } from '@supabase/supabase-js';

export type HomeownerAlert = {
  alert_code: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'INFO' | string;
  headline: string;
  body: string;
  evidence_hint: string | null;
  detected_at: string;
};

type FetchProps = {
  contractorId: string;
  workStateCode?: string | null;
};

export async function HomeownerAlerts({
  contractorId,
  workStateCode = null,
}: FetchProps) {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.warn('[HomeownerAlerts] missing supabase env vars; rendering empty');
    return null;
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.rpc(
    'compute_homeowner_alerts_v2',
    {
      p_contractor_id: contractorId,
      p_work_state_code: workStateCode,
    }
  );

  if (error) {
    console.warn('[HomeownerAlerts] rpc error:', error.message);
    return null;
  }

  const alerts = (data as HomeownerAlert[] | null) ?? null;
  return <HomeownerAlertsView alerts={alerts} />;
}

export function HomeownerAlertsView({
  alerts,
}: {
  alerts: HomeownerAlert[] | null;
}) {
  if (!alerts || alerts.length === 0) return null;

  const ordered = [...alerts].sort(
    (a, b) => severityOrder(a.severity) - severityOrder(b.severity)
  );

  const criticalCount = ordered.filter((a) => a.severity === 'CRITICAL').length;
  const highCount = ordered.filter((a) => a.severity === 'HIGH').length;

  return (
    <section
      className="mb-8 space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-5"
      aria-label="Groundcheck homeowner alerts"
      data-testid="homeowner-alerts"
    >
      <header className="flex items-baseline justify-between gap-4 border-b border-stone-200 pb-3">
        <h2 className="text-base font-semibold tracking-tight text-stone-900">
          Before you sign or pay a deposit
        </h2>
        <p className="text-xs uppercase tracking-wider text-stone-500">
          {ordered.length} alert{ordered.length === 1 ? '' : 's'}
          {criticalCount > 0 && (
            <>
              {' · '}
              <span className="font-semibold text-red-700">{`${criticalCount} critical`}</span>
            </>
          )}
          {highCount > 0 && (
            <>
              {' · '}
              <span className="font-semibold text-orange-700">{`${highCount} high`}</span>
            </>
          )}
        </p>
      </header>

      <ol className="space-y-3">
        {ordered.map((alert, i) => (
          <li key={`${alert.alert_code}-${i}`}>
            <AlertCard alert={alert} />
          </li>
        ))}
      </ol>

      <footer className="pt-2 text-xs text-stone-500">
        These alerts compile publicly available business records. This is not a consumer report under FCRA. Verify independently before any deposit.
      </footer>
    </section>
  );
}

function AlertCard({ alert }: { alert: HomeownerAlert }) {
  const styles = severityStyles(alert.severity);
  return (
    <article
      className={`rounded-lg border-l-4 px-4 py-3 ${styles.container}`}
      data-severity={alert.severity}
      data-alert-code={alert.alert_code}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 text-lg leading-none ${styles.icon}`}
          aria-hidden
        >
          {severityIcon(alert.severity)}
        </span>
        <div className="flex-1">
          <div
            className={`text-[10px] font-bold uppercase tracking-widest ${styles.label}`}
          >
            {alert.severity}
          </div>
          <h3 className="mt-1 text-sm font-semibold text-stone-900">
            {alert.headline}
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-stone-700">
            {alert.body}
          </p>
          {alert.evidence_hint && (
            <p className="mt-2 text-xs italic leading-relaxed text-stone-500">
              {alert.evidence_hint}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function severityOrder(s: string): number {
  if (s === 'CRITICAL') return 1;
  if (s === 'HIGH') return 2;
  if (s === 'MEDIUM') return 3;
  return 4;
}

function severityIcon(s: string): string {
  if (s === 'CRITICAL') return '⛔';
  if (s === 'HIGH') return '⚠️';
  if (s === 'MEDIUM') return '⚡';
  return 'ℹ️';
}

function severityStyles(s: string) {
  if (s === 'CRITICAL') {
    return {
      container: 'border-red-700 bg-red-50',
      icon: 'text-red-700',
      label: 'text-red-800',
    };
  }
  if (s === 'HIGH') {
    return {
      container: 'border-orange-600 bg-orange-50',
      icon: 'text-orange-600',
      label: 'text-orange-700',
    };
  }
  if (s === 'MEDIUM') {
    return {
      container: 'border-yellow-500 bg-yellow-50',
      icon: 'text-yellow-700',
      label: 'text-yellow-800',
    };
  }
  return {
    container: 'border-stone-300 bg-white',
    icon: 'text-stone-500',
    label: 'text-stone-600',
  };
}
