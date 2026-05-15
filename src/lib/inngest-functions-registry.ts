import {
  runTrustJobV2,
  runTrustSynthesizeV2,
  onTrustEvidenceAppended,
  onTrustReportCreated,
} from '@/lib/trust/inngest-functions'
import { opsPagerOnOrderConfirmed } from '@/inngest/functions/ops-pager'
import { disasterIngestNws } from '@/inngest/functions/disaster-ingest-nws'
import { disasterIngestFema } from '@/inngest/functions/disaster-ingest-fema'
import { permitIngestAustin } from '@/inngest/functions/permit-ingest-austin'
import { groundcheckAbandonRecoverable } from '@/inngest/functions/groundcheck-abandon-recoverable'
import { sweepStaleSnoozedCards } from '@/inngest/functions/sweep-stale-snoozed-cards'
import { securityCanaryAlert } from '@/inngest/security/canary-alert'
import { securityHoneypotSwarm } from '@/inngest/security/honeypot-swarm'
import { securityTrustVelocity } from '@/inngest/security/trust-velocity'

export const inngestFunctions = [
  disasterIngestNws,
  disasterIngestFema,
  permitIngestAustin,
  runTrustJobV2,
  runTrustSynthesizeV2,
  onTrustEvidenceAppended,
  onTrustReportCreated,
  opsPagerOnOrderConfirmed,
  groundcheckAbandonRecoverable,
  sweepStaleSnoozedCards,
  securityCanaryAlert,
  securityHoneypotSwarm,
  securityTrustVelocity,
]
