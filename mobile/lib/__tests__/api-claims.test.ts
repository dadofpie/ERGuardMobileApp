import { api, isAmbiguousSubmitError, setUnauthorizedHandler } from '../api';

function mockFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
  (globalThis.fetch as jest.Mock) = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => headers[k] ?? null },
    json: () => Promise.resolve(body),
  });
}

afterEach(() => {
  setUnauthorizedHandler(null);
  jest.restoreAllMocks();
});

describe('claims api', () => {
  it('getClaims surfaces errors instead of swallowing them', async () => {
    mockFetch(500, { ok: false, error: 'boom' });
    await expect(api.getClaims('t')).rejects.toThrow('boom');
  });

  it('getClaims routes 401 through the global handler', async () => {
    const handler = jest.fn();
    setUnauthorizedHandler(handler);
    mockFetch(401, { ok: false, error: 'Session expired' });
    await expect(api.getClaims('t')).rejects.toThrow();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('maps 409 codes to friendly messages', async () => {
    mockFetch(409, { ok: false, code: 'active_claim_exists', error: 'x' });
    await expect(api.createClaim('t', {})).rejects.toThrow(/active claim/);
  });

  it('flags network failures as ambiguous submits', async () => {
    (globalThis.fetch as jest.Mock) = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    const err = await api.createClaim('t', {}).catch((e) => e);
    expect(isAmbiguousSubmitError(err)).toBe(true);
    mockFetch(400, { ok: false, error: 'bad' });
    const bad = await api.createClaim('t', {}).catch((e) => e);
    expect(isAmbiguousSubmitError(bad)).toBe(false);
  });

  it('pollClaimUpdates sends 401 to the handler and exposes Retry-After on 429', async () => {
    const handler = jest.fn();
    setUnauthorizedHandler(handler);
    mockFetch(401, { ok: false, error: 'nope' });
    await expect(api.pollClaimUpdates('t', 20)).rejects.toMatchObject({ status: 401 });
    expect(handler).toHaveBeenCalledTimes(1);
    mockFetch(429, { ok: false }, { 'Retry-After': '7' });
    await expect(api.pollClaimUpdates('t', 20)).rejects.toMatchObject({ status: 429, retryAfter: 7 });
  });
});
