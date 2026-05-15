import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type AnySupabaseClient = SupabaseClient<any, any, any>;

let _secClient: AnySupabaseClient | null = null;
let _pubClient: AnySupabaseClient | null = null;

export function createSecurityClient(): AnySupabaseClient {
  if (_secClient) return _secClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY for security writes');
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'security' },
  }) as AnySupabaseClient;
  _secClient = client;
  return client;
}

export function createPublicClient(): AnySupabaseClient {
  if (_pubClient) return _pubClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as AnySupabaseClient;
  _pubClient = client;
  return client;
}

export const createServerClient = createSecurityClient;
export const createServerClientPublic = createPublicClient;
