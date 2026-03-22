import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Deno global ──
const mockEnv = new Map<string, string>([
  ['SUPABASE_URL', 'https://test.supabase.co'],
  ['SUPABASE_ANON_KEY', 'test-anon-key'],
]);

// ── Mock Supabase query builder ──
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockSingle = vi.fn();
const mockFrom = vi.fn();

function resetQueryBuilder() {
  const builder = {
    select: mockSelect,
    insert: mockInsert,
    eq: mockEq,
    order: mockOrder,
    limit: mockLimit,
    single: mockSingle,
    from: mockFrom,
  };

  // Chain methods return builder
  mockFrom.mockReturnValue(builder);
  mockSelect.mockReturnValue(builder);
  mockInsert.mockReturnValue(builder);
  mockEq.mockReturnValue(builder);
  mockOrder.mockReturnValue(builder);
  mockLimit.mockReturnValue(builder);

  return builder;
}

// ── Mock getUser for auth ──
const mockGetUser = vi.fn();

vi.mock('npm:@supabase/supabase-js@2', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

// ── Capture handler from Deno.serve ──
let handler: (req: Request) => Promise<Response>;

vi.stubGlobal('Deno', {
  serve: (fn: (req: Request) => Promise<Response>) => { handler = fn; },
  env: { get: (key: string) => mockEnv.get(key) ?? undefined },
});

// ── Import triggers Deno.serve() ──
await import('../../supabase/functions/asset-types/index.js');

// ── Helpers ──
const MOCK_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'test@example.com',
};

function authedRequest(method: string, body?: unknown): Request {
  const init: RequestInit = {
    method,
    headers: { Authorization: 'Bearer valid-token' },
  };
  if (body) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
  }
  return new Request('https://example.com/asset-types', init);
}

function unauthedRequest(method: string): Request {
  return new Request('https://example.com/asset-types', { method });
}

// ── Setup ──
beforeEach(() => {
  vi.clearAllMocks();
  resetQueryBuilder();
  mockEnv.set('SUPABASE_URL', 'https://test.supabase.co');
  mockEnv.set('SUPABASE_ANON_KEY', 'test-anon-key');
});

// ── Tests ──

describe('asset-types Edge Function', () => {
  // ── CORS ──
  it('OPTIONS returns 204', async () => {
    const res = await handler(
      new Request('https://example.com/asset-types', { method: 'OPTIONS' }),
    );
    expect(res.status).toBe(204);
  });

  // ── Auth ──
  it('AC4 — GET without auth returns 401', async () => {
    const res = await handler(unauthedRequest('GET'));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('unauthorized');
    expect(body.status).toBe(401);
  });

  it('AC4 — POST without auth returns 401', async () => {
    const res = await handler(unauthedRequest('POST'));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('unauthorized');
  });

  // ── GET ──
  it('AC2 — GET with auth returns asset types list', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: MOCK_USER }, error: null });

    const types = [
      { id: '1', name: 'FIIs', target_pct: 15, sort_order: 0 },
      { id: '2', name: 'Ações BR', target_pct: 25, sort_order: 1 },
    ];
    mockOrder.mockReturnValueOnce({ data: types, error: null });

    const res = await handler(authedRequest('GET'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(types);
  });

  it('GET returns 500 on database error', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: MOCK_USER }, error: null });
    mockOrder.mockReturnValueOnce({ data: null, error: { message: 'connection lost' } });

    const res = await handler(authedRequest('GET'));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('db_error');
  });

  // ── POST ──
  it('AC3 — POST with auth creates asset type', async () => {
    // Auth passes
    mockGetUser.mockResolvedValueOnce({ data: { user: MOCK_USER }, error: null });

    // Get max sort_order
    mockLimit.mockReturnValueOnce({ data: [{ sort_order: 9 }], error: null });

    // Insert
    const created = { id: '3', name: 'Crypto', target_pct: 3, sort_order: 10 };
    mockSingle.mockReturnValueOnce({ data: created, error: null });

    const res = await handler(authedRequest('POST', { name: 'Crypto', target_pct: 3 }));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual(created);
  });

  it('POST without name returns 400', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: MOCK_USER }, error: null });

    const res = await handler(authedRequest('POST', { target_pct: 5 }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('validation_error');
    expect(body.message).toContain('name is required');
  });

  it('POST with empty name returns 400', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: MOCK_USER }, error: null });

    const res = await handler(authedRequest('POST', { name: '  ', target_pct: 5 }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('validation_error');
  });

  it('POST with invalid JSON returns 400', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: MOCK_USER }, error: null });

    const req = new Request('https://example.com/asset-types', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-token',
        'Content-Type': 'application/json',
      },
      body: 'not json',
    });

    const res = await handler(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('bad_request');
  });

  // ── Method not allowed ──
  it('DELETE returns 405', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: MOCK_USER }, error: null });

    const req = new Request('https://example.com/asset-types', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer valid-token' },
    });
    const res = await handler(req);

    expect(res.status).toBe(405);
    const body = await res.json();
    expect(body.error).toBe('method_not_allowed');
  });
});
