import { describe, expect, it, vi } from 'vitest';
import { verifyTurnstileToken } from '../turnstile';

describe('verifyTurnstileToken', () => {
  const secretKey = 'test-secret';

  it('returns ok=true when Cloudflare returns success', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
    const r = await verifyTurnstileToken({ token: 'valid-token-12345', secretKey, fetchImpl: fetchImpl as never });
    expect(r.ok).toBe(true);
  });

  it('returns ok=false when Cloudflare returns success=false', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: false, 'error-codes': ['invalid-input-response'] }),
    });
    const r = await verifyTurnstileToken({ token: 'invalid-token-12345', secretKey, fetchImpl: fetchImpl as never });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('invalid-input-response');
  });

  it('returns ok=false when token is missing', async () => {
    const r = await verifyTurnstileToken({ token: '', secretKey });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('token_missing_or_invalid');
  });

  it('returns ok=false when token is too short', async () => {
    const r = await verifyTurnstileToken({ token: 'abc', secretKey });
    expect(r.ok).toBe(false);
  });

  it('returns ok=false when secret key is missing', async () => {
    const r = await verifyTurnstileToken({ token: 'valid-token-12345', secretKey: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('secret_key_missing');
  });

  it('returns ok=false on network error', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const r = await verifyTurnstileToken({ token: 'valid-token-12345', secretKey, fetchImpl: fetchImpl as never });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('network_error');
  });

  it('returns ok=false on non-200 from siteverify', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: () => Promise.resolve({}),
    });
    const r = await verifyTurnstileToken({ token: 'valid-token-12345', secretKey, fetchImpl: fetchImpl as never });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('siteverify_http_503');
  });

  it('passes remoteIp to siteverify when provided', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
    await verifyTurnstileToken({
      token: 'valid-token-12345',
      remoteIp: '203.0.113.7',
      secretKey,
      fetchImpl: fetchImpl as never,
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const call = fetchImpl.mock.calls[0];
    expect(call[1].body).toContain('remoteip=203.0.113.7');
  });
});
