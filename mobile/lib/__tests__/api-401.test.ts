/**
 * Tests for the global 401 handler in lib/api.ts.
 *
 * Mocks fetch so no real network happens; verifies that:
 *  - a 401 on an authenticated endpoint triggers the registered handler
 *  - a 401 on a public auth endpoint (login) does NOT trigger it
 *  - non-401 errors do not trigger it
 *  - the handler debounces (one call per burst) and re-arms
 */

import { api, setUnauthorizedHandler } from '../api';

const BASE = 'https://api.app.medicareplus.com.ph';

function mockFetchOnce(status: number, body: unknown) {
  (globalThis.fetch as jest.Mock) = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

describe('api 401 handling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    setUnauthorizedHandler(null);
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('triggers the unauthorized handler on a 401 from an authenticated endpoint', async () => {
    const handler = jest.fn();
    setUnauthorizedHandler(handler);
    mockFetchOnce(401, { ok: false, error: 'Session expired or invalid' });

    await expect(api.getCards('bad-token')).rejects.toThrow('Session expired or invalid');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not trigger the handler on 401 from public auth endpoints (login)', async () => {
    const handler = jest.fn();
    setUnauthorizedHandler(handler);
    mockFetchOnce(401, { ok: false, error: 'Invalid email or password' });

    await expect(api.login('user', 'wrong')).rejects.toThrow('Invalid email or password');
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not trigger the handler on non-401 errors', async () => {
    const handler = jest.fn();
    setUnauthorizedHandler(handler);
    mockFetchOnce(500, { ok: false, error: 'Server error' });

    await expect(api.getCards('token')).rejects.toThrow('Server error');
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not sign the user out when listing claims returns 401', async () => {
    const handler = jest.fn();
    setUnauthorizedHandler(handler);
    mockFetchOnce(401, { ok: false, error: 'Unauthorized' });

    await expect(api.getClaims('token')).resolves.toEqual([]);
    expect(handler).not.toHaveBeenCalled();
  });

  it('debounces a burst of 401s into a single handler call and re-arms after 5s', async () => {
    const handler = jest.fn();
    setUnauthorizedHandler(handler);
    mockFetchOnce(401, { ok: false, error: 'Session expired or invalid' });
    await expect(api.getCards('bad')).rejects.toThrow();
    mockFetchOnce(401, { ok: false, error: 'Session expired or invalid' });
    await expect(api.getCards('bad')).rejects.toThrow();
    expect(handler).toHaveBeenCalledTimes(1);

    // After 5s the handler is re-armed (if not already re-registered by sign-in).
    jest.advanceTimersByTime(5_100);
    mockFetchOnce(401, { ok: false, error: 'Session expired or invalid' });
    await expect(api.getCards('bad')).rejects.toThrow();
    expect(handler).toHaveBeenCalledTimes(2);
  });
});
