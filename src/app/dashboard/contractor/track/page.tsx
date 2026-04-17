import { PageHead } from '@/components/contractor/PageHead'

export const metadata = { title: 'Track Live — earthmove.io' }

export default function TrackPlaceholder() {
  return (
    <>
      <PageHead
        kicker="Track live"
        title={<>Every truck, on a <em>single pane</em>.</>}
        subtitle="Real-time dispatch map, driver ETAs, geofence crossings, and per-load photos."
      />
      <div className="ec-placeholder">
        <span className="ec-placeholder__badge">Coming in Tranche 2</span>
        <p style={{ color: 'var(--ink-500)', fontSize: 14, maxWidth: 560 }}>
          We'll stream GPS pings from the driver app here, draw geofences around your project sites,
          and raise the AttentionQueue when a truck arrives, idles, or misses a window.
        </p>
      </div>
    </>
  )
}
