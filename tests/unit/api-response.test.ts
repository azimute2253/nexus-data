import { describe, it, expect } from 'vitest';
import { jsonResponse, errorResponse } from '../../supabase/functions/shared/response.js';

describe('jsonResponse', () => {
  it('returns 200 with JSON body and CORS headers', async () => {
    const res = jsonResponse({ status: 'ok' });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');

    const body = await res.json();
    expect(body).toEqual({ status: 'ok' });
  });

  it('supports custom status codes', async () => {
    const res = jsonResponse({ id: '123' }, 201);
    expect(res.status).toBe(201);
  });

  it('serializes arrays', async () => {
    const data = [{ id: '1' }, { id: '2' }];
    const res = jsonResponse(data);
    const body = await res.json();
    expect(body).toEqual(data);
  });
});

describe('errorResponse', () => {
  it('AC5 — returns consistent error JSON format { error, message, status }', async () => {
    const res = errorResponse('unauthorized', 'Missing Authorization header', 401);

    expect(res.status).toBe(401);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');

    const body = await res.json();
    expect(body).toEqual({
      error: 'unauthorized',
      message: 'Missing Authorization header',
      status: 401,
    });
  });

  it('returns 500 for server errors', async () => {
    const res = errorResponse('server_error', 'Something went wrong', 500);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('server_error');
    expect(body.message).toBe('Something went wrong');
    expect(body.status).toBe(500);
  });

  it('returns 400 for validation errors', async () => {
    const res = errorResponse('validation_error', 'name is required', 400);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('validation_error');
  });
});
