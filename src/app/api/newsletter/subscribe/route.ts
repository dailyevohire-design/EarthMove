import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const { email } = await request.json()

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase.from('waitlist').insert({
    email,
    waitlist_type: 'newsletter',
  })

  if (error) {
    console.error('[newsletter/subscribe] insert failed', error)
    return NextResponse.json({ error: 'Subscribe failed' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
