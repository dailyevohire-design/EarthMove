import { PageHead } from '@/components/contractor/PageHead'

export const metadata = { title: 'Billing — earthmove.io' }

export default function BillingPlaceholder() {
  return (
    <>
      <PageHead
        kicker="Billing"
        title={<>Net terms, <em>one statement</em>.</>}
        subtitle="Consolidated invoices across suppliers, exportable to QuickBooks, Procore, and Sage."
      />
      <div className="ec-placeholder">
        <span className="ec-placeholder__badge">Coming in Tranche 3</span>
      </div>
    </>
  )
}
