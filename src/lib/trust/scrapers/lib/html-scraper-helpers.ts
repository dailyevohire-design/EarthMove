// Shared fetch / retry / multi-strategy / body-capture utilities for HTML scrapers.
// Pattern H (defensive multi-strategy with attempts diagnostic) and Pattern I
// (error body capture on 4xx/5xx) live here.

export interface AttemptRecord {
  strategy: string;
  url: string;
  method: 'GET' | 'POST';
  http_status: number | null;
  duration_ms: number;
  error?: string;
  body_excerpt?: string;
}

export interface FetchOptions {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string | URLSearchParams;
  timeoutMs?: number;
  strategy: string;
}

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export async function fetchWithCapture(
  url: string,
  options: FetchOptions,
): Promise<{ ok: boolean; status: number | null; body: string; attempt: AttemptRecord }> {
  const t0 = Date.now();
  const method = options.method ?? 'GET';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  const attempt: AttemptRecord = {
    strategy: options.strategy,
    url,
    method,
    http_status: null,
    duration_ms: 0,
  };

  try {
    const resp = await fetch(url, {
      method,
      headers: {
        'User-Agent': DEFAULT_UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        ...(options.headers ?? {}),
      },
      body: options.body,
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeoutId);
    const body = await resp.text();
    attempt.http_status = resp.status;
    attempt.duration_ms = Date.now() - t0;
    if (!resp.ok) {
      attempt.error = `HTTP ${resp.status}`;
      attempt.body_excerpt = body.slice(0, 400);
      return { ok: false, status: resp.status, body, attempt };
    }
    return { ok: true, status: resp.status, body, attempt };
  } catch (e: unknown) {
    clearTimeout(timeoutId);
    attempt.duration_ms = Date.now() - t0;
    attempt.error = e instanceof Error ? e.message : String(e);
    return { ok: false, status: null, body: '', attempt };
  }
}

export interface StrictNameMatchOptions {
  query: string;
  candidate: string;
  /** Require candidate to contain query (case-insensitive, normalized). */
  mode: 'contains' | 'starts_with' | 'exact';
}

export function strictNameMatch(opts: StrictNameMatchOptions): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/\b(inc|llc|llp|ltd|corp|corporation|company|co|the)\b\.?/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  const q = norm(opts.query);
  const c = norm(opts.candidate);
  if (!q || !c) return false;
  switch (opts.mode) {
    case 'exact':
      return q === c;
    case 'starts_with':
      return c.startsWith(q);
    case 'contains':
      return c.includes(q);
  }
}
