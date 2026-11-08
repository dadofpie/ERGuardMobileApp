/**
 * SEC-014: sensitive actions must prove user presence through the OS, not just
 * carry a session. These tests pin the outcome mapping the screens rely on.
 */
import * as LocalAuthentication from 'expo-local-authentication';

import { requestStepUp } from '../biometrics';

jest.mock('expo-local-authentication', () => ({
  authenticateAsync: jest.fn(),
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
}));

jest.mock('@/lib/session', () => ({
  getSession: jest.fn(),
  saveBiometricSession: jest.fn(),
  clearBiometricSession: jest.fn(),
}));

jest.mock('@/lib/storage', () => ({
  isBiometricEnabled: jest.fn(),
  setBiometricEnabled: jest.fn(),
}));

const authenticate = LocalAuthentication.authenticateAsync as jest.Mock;

describe('requestStepUp', () => {
  afterEach(() => jest.resetAllMocks());

  it('passes when the OS accepts a biometric or the device passcode', async () => {
    authenticate.mockResolvedValue({ success: true });
    await expect(requestStepUp('Verify it is you')).resolves.toBe('passed');
  });

  it('allows the device passcode fallback (presence, not biometric strength)', async () => {
    authenticate.mockResolvedValue({ success: true });
    await requestStepUp('Verify it is you');
    expect(authenticate).toHaveBeenCalledWith(
      expect.objectContaining({ disableDeviceFallback: false }),
    );
  });

  it('reports a cancelled prompt as cancelled', async () => {
    authenticate.mockResolvedValue({ success: false, error: 'user_cancel' });
    await expect(requestStepUp('Verify it is you')).resolves.toBe('cancelled');
  });

  it('reports a device with no enrolled credential as unavailable', async () => {
    authenticate.mockResolvedValue({ success: false, error: 'not_enrolled' });
    await expect(requestStepUp('Verify it is you')).resolves.toBe('unavailable');

    authenticate.mockResolvedValue({ success: false, error: 'passcode_not_set' });
    await expect(requestStepUp('Verify it is you')).resolves.toBe('unavailable');
  });

  it('treats a native failure as unavailable so callers can fail closed', async () => {
    authenticate.mockRejectedValue(new Error('native module unavailable'));
    await expect(requestStepUp('Verify it is you')).resolves.toBe('unavailable');
  });
});
