import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock Deno global ──
const mockEnv = new Map<string, string>([
  ['SUPABASE_URL', 'https://test.supabase.co'],
  ['SUPABASE_ANON_KEY', 'test-anon-key'],
]);

vi.stubGlobal('Deno', {
  env: { get: (key: string) => mockEnv.get(key) ?? undefined },
});

// ── Mock @supabase/supabase-js ──
const mockGetUser = vi.fn();

vi.mock('npm:@supabase/supabase-js@2', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

// ── Import after mocks ──
import { requireAuth } from '../../supabase/functions/shared/auth.js';

// ── Helpers ──
function makeRequest(authHeader?: string): Request {
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) {
    headers['Authorization'] = authHeader;
  }
  return new Request('https://example.com', { headers });
}

const MOCK_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'test@example.com',
};

// ── Tests ──

beforeEach(() => {
  vi.clearAllMocks();
  mockEnv.set('SUPABASE_URL', 'https://test.supabase.co');
  mockEnv.set('SUPABASE_ANON_KEY', 'test-anon-key');
});

describe('requireAuth', () => {
  it('AC4 — returns 401 when Authorization header is missing', async () => {
    const result = await requireAuth(makeRequest());

    expect(result).toBeInstanceOf(Response);
    const body = await (result as Response).json();
    expect((result as Response).status).toBe(401);
    expect(body.error).toBe('unauthorized');
    expect(body.message).toContain('Missing Authorization header');
  });

  it('AC4 — returns 401 when bearer token is empty', async () => {
    const result = await requireAuth(makeRequest('Bearer '));

    expect(result).toBeInstanceOf(Response);
    const body = await (result as Response).json();
    expect((result as Response).status).toBe(401);
    expect(body.error).toBe('unauthorized');
  });

  it('returns 401 when Supabase rejects the token', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Invalid JWT' },
    });

    const result = await requireAuth(makeRequest('Bearer invalid-token'));

    expect(result).toBeInstanceOf(Response);
    const body = await (result as Response).json();
    expect((result as Response).status).toBe(401);
    expect(body.message).toBe('Invalid JWT');
  });

  it('returns user on valid token', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: MOCK_USER },
      error: null,
    });

    const result = await requireAuth(makeRequest('Bearer valid-token'));

    expect(result).not.toBeInstanceOf(Response);
    expect((result as { user: typeof MOCK_USER }).user).toEqual(MOCK_USER);
  });

  it('returns 500 when SUPABASE_URL is missing', async () => {
    mockEnv.delete('SUPABASE_URL');

    const result = await requireAuth(makeRequest('Bearer some-token'));

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(500);
    const body = await (result as Response).json();
    expect(body.error).toBe('server_error');
  });
});
