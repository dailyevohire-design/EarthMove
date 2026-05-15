import { notFound } from 'next/navigation';

// LAUNCH-DAY: /share/[token] returns 500 on Vercel prod due to an RSC render bug
// unrelated to the consume_trust_share_grant RPC (RPC verified working via MCP).
// Press kit primary URLs use /trust/verify/{reportId} — share links are non-critical
// for launch. Replacing this route with notFound() eliminates the 500 surface and is
// reversible once the RSC bug is diagnosed.
//
// REVIVAL NOTE: when restoring the share route, the consume_trust_share_grant RPC
// returns reportRow with .id — wrap the rendered <TrustReportView> in:
//   <PressWindowGuard reportId={reportRow.id}>...</PressWindowGuard>
// imported from '@/components/trust/PressWindowGuard' for kill-switch coverage.

export default function SharedReportPage() {
  notFound();
}
