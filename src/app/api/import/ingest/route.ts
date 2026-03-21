import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'

const RecordSchema = z.object({
  supplier_name:  z.string().optional(),
  yard_address:   z.string().optional(),
  yard_city:      z.string().optional(),
  yard_state:     z.string().optional(),
  yard_zip:       z.string().optional(),
  yard_phone:     z.string().optional(),
  material_name:  z.string().optional(),
  price:          z.string().optional(),
  unit:           z.string().optional(),
  min_order:      z.string().optional(),
  notes:          z.string().optional(),
}).passthrough()

const PayloadSchema = z.object({
  source:       z.string().default('api'),
  source_url:   z.string().url().optional(),
  source_name:  z.string().optional(),
  market_slug:  z.string().optional(),
  records:      z.array(RecordSchema).min(1).max(500),
})

export async function POST(req: NextRequest) {
  // API key auth for automated scraper pipeline
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey || apiKey !== process.env.IMPORT_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const parsed = PayloadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 422 })
  }

  const { source, source_url, source_name, market_slug, records } = parsed.data
  const supabase = createAdminClient()

  let marketId: string | null = null
  if (market_slug) {
    const { data } = await supabase.from('markets').select('id').eq('slug', market_slug).single()
    marketId = data?.id ?? null
  }

  const { data: batch, error: batchErr } = await supabase
    .from('import_batches')
    .insert({
      source, source_url: source_url ?? null,
      source_name: source_name ?? null,
      market_id: marketId,
      total_records: records.length,
      raw_payload: { source, records },
    })
    .select('id').single()

  if (batchErr || !batch) {
    return NextResponse.json({ error: 'Failed to create batch' }, { status: 500 })
  }

  const rows = records.map(r => ({
    batch_id: batch.id,
    raw_supplier_name: (r as any).supplier_name ?? null,
    raw_yard_address:  (r as any).yard_address ?? null,
    raw_yard_city:     (r as any).yard_city ?? null,
    raw_yard_state:    (r as any).yard_state ?? null,
    raw_yard_zip:      (r as any).yard_zip ?? null,
    raw_yard_phone:    (r as any).yard_phone ?? null,
    raw_material_name: (r as any).material_name ?? null,
    raw_price:         (r as any).price ?? null,
    raw_unit:          (r as any).unit ?? null,
    raw_min_order:     (r as any).min_order ?? null,
    raw_notes:         (r as any).notes ?? null,
    raw_data:          r,
    status: 'pending_review',
  }))

  const { error: recordsErr } = await supabase.from('import_records').insert(rows)
  if (recordsErr) {
    await supabase.from('import_batches').delete().eq('id', batch.id)
    return NextResponse.json({ error: 'Failed to insert records' }, { status: 500 })
  }

  return NextResponse.json({ success: true, batch_id: batch.id, records_created: records.length })
}
