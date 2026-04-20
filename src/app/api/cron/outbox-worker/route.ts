import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { createAdminClient } from '@/lib/supabase/server';
import { toE164 } from '@/lib/sms/phone';
import { getDispatchFromNumber } from '@/lib/sms/twilio';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BATCH_SIZE = 20;

function authorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get('authorization');
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`
  // See https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
  return header === `Bearer ${expected}`;
}

type OutboxRow = {
  id: number;
  event_type: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
};

type DriverSmsPayload = {
  phone?: string;
  body?: string;
  reason?: string;
  dispatch_id?: string | null;
  metadata?: Record<string, unknown>;
};

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    console.warn('[outbox-worker] unauthorized request', {
      ua: req.headers.get('user-agent'),
      ip: req.headers.get('x-forwarded-for'),
    });
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  let processed = 0;
  let failed = 0;
  let skipped = 0;

  try {
    const { data: events, error: qErr } = await supabase
      .from('outbox_events')
      .select('id, event_type, payload, attempts, max_attempts')
      .eq('evt_status', 'pending')
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (qErr) {
      console.error('[outbox-worker] query error', qErr);
      return NextResponse.json({ error: 'query_failed', detail: qErr.message }, { status: 500 });
    }
    if (!events || events.length === 0) {
      return NextResponse.json({ processed: 0, failed: 0, skipped: 0 });
    }

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) {
      return NextResponse.json({ error: 'twilio_env_missing' }, { status: 500 });
    }
    const client = twilio(sid, token);
    let fromNumber: string;
    try {
      fromNumber = getDispatchFromNumber();
    } catch (e) {
      return NextResponse.json({ error: 'no_from_number', detail: String(e) }, { status: 500 });
    }

    for (const raw of events as OutboxRow[]) {
      const { data: claimed, error: claimErr } = await supabase
        .from('outbox_events')
        .update({ evt_status: 'processing', last_attempt_at: new Date().toISOString() })
        .eq('id', raw.id)
        .eq('evt_status', 'pending')
        .select('id')
        .maybeSingle();

      if (claimErr) {
        console.error('[outbox-worker] claim error', { id: raw.id, err: claimErr.message });
        failed++;
        continue;
      }
      if (!claimed) {
        skipped++;
        continue;
      }

      try {
        if (raw.event_type === 'driver_sms') {
          const p = raw.payload as DriverSmsPayload;
          if (!p.phone || !p.body) {
            throw new Error(`driver_sms missing phone or body: ${JSON.stringify({ phone: !!p.phone, body: !!p.body })}`);
          }
          const to = toE164(p.phone);
          await client.messages.create({ body: p.body, from: fromNumber, to });
        } else {
          throw new Error(`unsupported event_type: ${raw.event_type}`);
        }

        const { error: sentErr } = await supabase
          .from('outbox_events')
          .update({
            evt_status: 'sent',
            processed_at: new Date().toISOString(),
            attempts: raw.attempts + 1,
          })
          .eq('id', raw.id);
        if (sentErr) {
          console.error('[outbox-worker] mark-sent failed (SMS already sent!)', { id: raw.id, err: sentErr.message });
        }
        processed++;
      } catch (err: unknown) {
        const attempts = raw.attempts + 1;
        const terminal = attempts >= raw.max_attempts;
        const msg = err instanceof Error ? err.message : String(err);
        const { error: failErr } = await supabase
          .from('outbox_events')
          .update({
            evt_status: terminal ? 'dead_letter' : 'pending',
            attempts,
            error_message: msg.slice(0, 2000),
            last_attempt_at: new Date().toISOString(),
            ...(terminal ? { processed_at: new Date().toISOString() } : {}),
          })
          .eq('id', raw.id);
        if (failErr) {
          console.error('[outbox-worker] mark-failed failed', { id: raw.id, err: failErr.message });
        }
        console.warn('[outbox-worker] event failed', {
          id: raw.id,
          event_type: raw.event_type,
          attempts,
          terminal,
          error: msg,
        });
        failed++;
      }
    }

    return NextResponse.json({ processed, failed, skipped });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[outbox-worker] fatal', msg);
    return NextResponse.json({ error: 'worker_failed', detail: msg }, { status: 500 });
  }
}
