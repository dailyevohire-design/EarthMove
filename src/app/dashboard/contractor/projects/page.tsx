import { PageHead } from '@/components/contractor/PageHead'

export const metadata = { title: 'Projects — earthmove.io' }

export default function ProjectsPlaceholder() {
  return (
    <>
      <PageHead
        kicker="Projects"
        title={<>Every job, <em>budgeted and traced</em>.</>}
        subtitle="Create and track projects, attach orders, see real-time spend vs budget with phase milestones."
      />
      <div className="ec-placeholder">
        <span className="ec-placeholder__badge">Coming in Tranche 2</span>
        <p style={{ color: 'var(--ink-500)', fontSize: 14, maxWidth: 560 }}>
          The <code>projects</code> table is live; migration 020 also wired <code>orders.project_id</code>
          and a trigger that keeps <code>projects.spend_cents</code> in sync on every completed order.
        </p>
      </div>
    </>
  )
}
