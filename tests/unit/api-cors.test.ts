import { describe, it, expect } from 'vitest';
import { CORS_HEADERS, handleCors } from '../../supabase/functions/shared/cors.js';

describe('CORS helpers', () => {
  it('CORS_HEADERS includes required headers', () => {
    expect(CORS_HEADERS['Access-Control-Allow-Origin']).toBe('*');
    expect(CORS_HEADERS['Access-Control-Allow-Methods']).toContain('GET');
    expect(CORS_HEADERS['Access-Control-Allow-Methods']).toContain('POST');
    expect(CORS_HEADERS['Access-Control-Allow-Headers']).toContain('Authorization');
    expect(CORS_HEADERS['Access-Control-Allow-Headers']).toContain('Content-Type');
  });

  it('handleCors returns 204 for OPTIONS requests', () => {
    const req = new Request('https://example.com', { method: 'OPTIONS' });
    const res = handleCors(req);

    expect(res).not.toBeNull();
    expect(res!.status).toBe(204);
    expect(res!.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('handleCors returns null for non-OPTIONS requests', () => {
    const getReq = new Request('https://example.com', { method: 'GET' });
    expect(handleCors(getReq)).toBeNull();

    const postReq = new Request('https://example.com', { method: 'POST' });
    expect(handleCors(postReq)).toBeNull();
  });
});
