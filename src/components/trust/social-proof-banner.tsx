import { createAdminClient } from '@/lib/supabase/server';

interface Props {
  contractorId: string;
}

export async function SocialProofBanner({ contractorId }: Props) {
  const supabase = createAdminClient();

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('trust_reports')
    .select('id', { count: 'exact', head: true })
    .eq('contractor_id', contractorId)
    .gt('created_at', since);

  if (!count || count < 3) return null;

  return (
    <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm">
      <span className="font-medium">{count} people</span> have checked this contractor in the last
      30 days.
    </div>
  );
}
