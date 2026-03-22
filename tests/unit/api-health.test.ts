import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Deno.serve to capture the handler ──
let handler: (req: Request) => Promise<Response>;

vi.stubGlobal('Deno', {
  serve: (fn: (req: Request) => Promise<Response>) => { handler = fn; },
  env: { get: () => undefined },
});

// ── Import triggers Deno.serve() ──
await import('../../supabase/functions/health/index.js');

describe('health Edge Function', () => {
  it('AC1 — GET returns 200 + { status: "ok" }', async () => {
    const req = new Request('https://example.com/health', { method: 'GET' });
    const res = await handler(req);

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
    expect(typeof body.timestamp).toBe('string');
  });

  it('returns CORS headers', async () => {
    const req = new Request('https://example.com/health', { method: 'GET' });
    const res = await handler(req);

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Content-Type')).toBe('application/json');
  });

  it('OPTIONS returns 204 (CORS preflight)', async () => {
    const req = new Request('https://example.com/health', { method: 'OPTIONS' });
    const res = await handler(req);

    expect(res.status).toBe(204);
  });

  it('POST returns 405 method not allowed', async () => {
    const req = new Request('https://example.com/health', { method: 'POST' });
    const res = await handler(req);

    expect(res.status).toBe(405);
    const body = await res.json();
    expect(body.error).toBe('method_not_allowed');
  });
});
