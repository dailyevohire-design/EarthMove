import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TrustReportView, { type TrustReport } from '@/components/trust/TrustReportView'
import { ShareReportButton } from '@/components/trust/ShareReportButton'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Trust report — earthmove.io' }

export default async function TrustReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/dashboard/trust/report/${id}`)

  const { data: report, error } = await supabase
    .from('trust_reports')
    .select('*')
    .eq('id', id)
    .maybeSingle<TrustReport>()

  if (error || !report) notFound()

  return (
    <>
      <div className="mx-auto flex max-w-4xl items-center justify-end px-6 py-3">
        <ShareReportButton reportId={id} />
      </div>
      <TrustReportView report={report} />
    </>
  )
}
