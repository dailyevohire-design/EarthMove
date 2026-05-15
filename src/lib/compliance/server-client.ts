import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type AnySupabaseClient = SupabaseClient<any, any, any>;

let _c: AnySupabaseClient | null = null;
export function createComplianceClient(): AnySupabaseClient {
  if (_c) return _c;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'compliance' },
  }) as AnySupabaseClient;
  _c = client;
  return client;
}

let _p: AnySupabaseClient | null = null;
export function createPublicClient(): AnySupabaseClient {
  if (_p) return _p;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as AnySupabaseClient;
  _p = client;
  return client;
}
