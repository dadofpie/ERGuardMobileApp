/**
 * SEC-012 regression tests: the local preview account is dev-only and cannot be
 * enabled in a release bundle, whatever the environment says.
 */

type DevGlobal = { __DEV__?: boolean };

function loadPreviewWithDev(dev: boolean) {
  (globalThis as DevGlobal).__DEV__ = dev;
  let loaded: typeof import('../preview') | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loaded = require('../preview') as typeof import('../preview');
  });
  return loaded!;
}

describe('preview mode gating', () => {
  const originalDev = (globalThis as DevGlobal).__DEV__;
  const originalEnv = process.env.EXPO_PUBLIC_DEV_PREVIEW;

  afterEach(() => {
    (globalThis as DevGlobal).__DEV__ = originalDev;
    if (originalEnv === undefined) delete process.env.EXPO_PUBLIC_DEV_PREVIEW;
    else process.env.EXPO_PUBLIC_DEV_PREVIEW = originalEnv;
    jest.resetModules();
  });

  it('is enabled in development builds', () => {
    expect(loadPreviewWithDev(true).PREVIEW_ENABLED).toBe(true);
  });

  it('stays disabled in a release build even when EXPO_PUBLIC_DEV_PREVIEW=1', () => {
    process.env.EXPO_PUBLIC_DEV_PREVIEW = '1';
    const preview = loadPreviewWithDev(false);
    expect(preview.PREVIEW_ENABLED).toBe(false);
  });

  it('refuses to start a release build configured for preview', () => {
    process.env.EXPO_PUBLIC_DEV_PREVIEW = '1';
    expect(() => loadPreviewWithDev(false).assertPreviewConfiguration()).toThrow(
      /Invalid build configuration/,
    );
  });

  it('starts a release build with no preview flag', () => {
    delete process.env.EXPO_PUBLIC_DEV_PREVIEW;
    expect(() => loadPreviewWithDev(false).assertPreviewConfiguration()).not.toThrow();
  });

  it('allows the preview flag in development builds', () => {
    process.env.EXPO_PUBLIC_DEV_PREVIEW = '1';
    expect(() => loadPreviewWithDev(true).assertPreviewConfiguration()).not.toThrow();
  });
});
