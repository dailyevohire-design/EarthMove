import { createAdminClient } from '@/lib/supabase/server';
import type { ReactNode } from 'react';

// Universal read-side guard for public trust report renders.
// Calls is_press_window_safe(uuid) → falls through to children if TRUE, returns
// a neutral "under review" placeholder if FALSE. Layered with the data-layer
// evidence floor (mig 275) — defense in depth.
//
// FALSE conditions enforced server-side by the predicate:
//   - launch_emergency_controls.public_render_enabled = FALSE (master kill switch)
//   - trust_reports.trust_score IS NULL
//   - adverse-band score (<60) without adverse evidence (legacy rows)
//   - any other condition mig 269's predicate encodes
export async function PressWindowGuard({
  reportId,
  children,
}: {
  reportId: string;
  children: ReactNode;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('is_press_window_safe', {
    p_report_id: reportId,
  });

  // Fail closed — if the predicate errors, suppress the render. Safer to show
  // "under review" than to show a report we couldn't validate.
  if (error || data !== true) {
    return (
      <main className="min-h-screen bg-stone-50 flex items-center justify-center px-6 py-24">
        <div className="max-w-md text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stone-100 text-stone-600 text-xs font-medium uppercase tracking-wider">
            Under Review
          </div>
          <h1 className="text-2xl font-medium text-stone-900">
            This report is being verified
          </h1>
          <p className="text-sm text-stone-600 leading-relaxed">
            Our quality team is reviewing the underlying public records for this entity.
            Please check back later. If you believe a report is missing or inaccurate, contact
            support and reference the report ID.
          </p>
          <p className="text-xs text-stone-400 pt-2 font-mono">{reportId}</p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
