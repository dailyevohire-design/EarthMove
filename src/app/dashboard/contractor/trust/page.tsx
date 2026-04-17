import { PageHead } from '@/components/contractor/PageHead'

export const metadata = { title: 'Trust — earthmove.io' }

export default function TrustPlaceholder() {
  return (
    <>
      <PageHead
        kicker="Trust"
        title={<>Know who you're <em>dealing with</em>.</>}
        subtitle="Run a 360° check on any supplier, broker, or subcontractor. License, insurance, court filings, OSHA."
      />
      <div className="ec-placeholder">
        <span className="ec-placeholder__badge">Coming in Tranche 2</span>
        <p style={{ color: 'var(--ink-500)', fontSize: 14, maxWidth: 560 }}>
          Trust lookups live behind /api/trust/lookup today. Tranche 2 wires the contractor-side UI
          with saved reports, shared org library, and automatic alerts when a scored entity changes.
        </p>
      </div>
    </>
  )
}
