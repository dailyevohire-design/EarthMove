import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ yards: [] }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ yards: [] }, { status: 403 })

  const supplierId = req.nextUrl.searchParams.get('supplier_id')
  if (!supplierId) return NextResponse.json({ yards: [] })

  const { data: yards } = await supabase
    .from('supply_yards')
    .select('id, name, city, state')
    .eq('supplier_id', supplierId)
    .eq('is_active', true)
    .order('name')

  return NextResponse.json({ yards: yards ?? [] })
}
