import { describe, it, expect, beforeEach, vi } from 'vitest';

// Set env vars before importing the module
beforeEach(() => {
  vi.resetModules();
  process.env.PUBLIC_SUPABASE_URL = 'https://test-project.supabase.co';
  process.env.PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
});

describe('supabase client', () => {
  it('getAnonClient returns a SupabaseClient', async () => {
    const { getAnonClient } = await import('../../src/lib/supabase.js');
    const client = getAnonClient();
    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();
    expect(typeof client.auth.getSession).toBe('function');
  });

  it('getServiceClient returns a SupabaseClient', async () => {
    const { getServiceClient } = await import('../../src/lib/supabase.js');
    const client = getServiceClient();
    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();
  });

  it('throws when PUBLIC_SUPABASE_URL is missing', async () => {
    delete process.env.PUBLIC_SUPABASE_URL;
    const { getAnonClient } = await import('../../src/lib/supabase.js');
    expect(() => getAnonClient()).toThrow('Missing environment variable: PUBLIC_SUPABASE_URL');
  });

  it('throws when PUBLIC_SUPABASE_ANON_KEY is missing', async () => {
    delete process.env.PUBLIC_SUPABASE_ANON_KEY;
    const { getAnonClient } = await import('../../src/lib/supabase.js');
    expect(() => getAnonClient()).toThrow('Missing environment variable: PUBLIC_SUPABASE_ANON_KEY');
  });

  it('throws when SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { getServiceClient } = await import('../../src/lib/supabase.js');
    expect(() => getServiceClient()).toThrow('Missing environment variable: SUPABASE_SERVICE_ROLE_KEY');
  });

  it('getSession returns null when no session exists', async () => {
    const { getSession } = await import('../../src/lib/supabase.js');
    const session = await getSession();
    expect(session).toBeNull();
  });

  it('getCurrentUser returns null when no session exists', async () => {
    const { getCurrentUser } = await import('../../src/lib/supabase.js');
    const user = await getCurrentUser();
    expect(user).toBeNull();
  });
});
