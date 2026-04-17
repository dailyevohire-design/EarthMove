import { PageHead } from '@/components/contractor/PageHead'

export const metadata = { title: 'Team — earthmove.io' }

export default function TeamPlaceholder() {
  return (
    <>
      <PageHead
        kicker="Team"
        title={<>Your crew, your <em>controls</em>.</>}
        subtitle="Invite superintendents and office managers. Set spend limits and approval rules per role."
      />
      <div className="ec-placeholder">
        <span className="ec-placeholder__badge">Coming in Tranche 3</span>
      </div>
    </>
  )
}
