import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
  TELEMETRY_EVENT_TYPE_SET,
  eventTypeToEntityType,
  eventTypeToSeverity,
  type TelemetryEvent,
} from '@/lib/telemetry-types';
import { isBotUserAgent } from '@/lib/server/bot-detect';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SESSION_COOKIE = '__es_sid';
const MAX_EVENTS_PER_BATCH = 50;
const MAX_PAYLOAD_BYTES = 4096;

type IngestBody = { events?: TelemetryEvent[] };

function isUuid(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

export async function POST(req: Request) {
  const ua = req.headers.get('user-agent');
  if (isBotUserAgent(ua)) {
    return NextResponse.json({ ok: true, bot: true, accepted: 0 }, { status: 200 });
  }

  let body: IngestBody = {};
  try {
    body = (await req.json()) as IngestBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const events = Array.isArray(body.events) ? body.events.slice(0, MAX_EVENTS_PER_BATCH) : [];
  if (events.length === 0) {
    return NextResponse.json({ ok: true, accepted: 0 });
  }

  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value ?? null;
  if (!sessionId) {
    // No session cookie = client hasn't heartbeated yet. Drop silently.
    return NextResponse.json({ ok: true, accepted: 0, reason: 'no_session' });
  }

  // Get auth + cart context from live_sessions row to make sampling decisions.
  const svc = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const ssr = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );
  const { data: { user } } = await ssr.auth.getUser();

  const { data: sessionRow } = await svc
    .from('live_sessions')
    .select('has_cart, has_groundcheck, has_signed_in')
    .eq('session_id', sessionId)
    .maybeSingle();

  const sessionIsEngaged = Boolean(
    sessionRow?.has_signed_in || sessionRow?.has_cart || sessionRow?.has_groundcheck || user
  );

  // Sampling: page.view / page.idle for anon-cold sessions get 10% sampling.
  // Everything else always written.
  const rows: Array<{
    entity_type: string;
    entity_id: string | null;
    event_type: string;
    severity: string;
    source: string;
    payload: Record<string, unknown>;
    actor_id: string | null;
    session_id: string;
  }> = [];

  let dropped = 0;
  for (const ev of events) {
    if (!ev || typeof ev.type !== 'string') {
      dropped++;
      continue;
    }
    if (!TELEMETRY_EVENT_TYPE_SET.has(ev.type)) {
      dropped++;
      continue;
    }
    const payload = (ev.payload && typeof ev.payload === 'object' ? ev.payload : {}) as Record<string, unknown>;
    if (JSON.stringify(payload).length > MAX_PAYLOAD_BYTES) {
      dropped++;
      continue;
    }

    // Sampling decision
    const isLowSignal = ev.type === 'page.view' || ev.type === 'page.idle';
    if (isLowSignal && !sessionIsEngaged && Math.random() >= 0.1) {
      dropped++;
      continue;
    }

    const entityIdRaw = payload['entity_id'] ?? payload['order_id'] ?? payload['subject_id'] ?? null;
    const entityId = isUuid(entityIdRaw) ? (entityIdRaw as string) : null;

    rows.push({
      entity_type: eventTypeToEntityType(ev.type, Boolean(entityId)),
      entity_id: entityId,
      event_type: ev.type,
      severity: eventTypeToSeverity(ev.type),
      source: 'web',
      payload: { ...payload, _ts_client: typeof ev.ts === 'number' ? ev.ts : null },
      actor_id: user?.id ?? null,
      session_id: sessionId,
    });
  }

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, accepted: 0, dropped });
  }

  const { error } = await svc.from('entity_events').insert(rows);
  if (error) {
    console.error('[telemetry] insert failed', error);
    return NextResponse.json({ ok: false, error: 'insert_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, accepted: rows.length, dropped });
}
