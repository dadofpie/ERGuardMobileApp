import { Alert } from 'react-native';

import { offerBiometricSetup } from '../biometrics';
import { isBiometricEnabled } from '../storage';

jest.mock('../storage', () => ({
  isBiometricEnabled: jest.fn(),
  setBiometricEnabled: jest.fn(),
}));

jest.mock('../session', () => ({
  getSession: jest.fn(),
  saveBiometricSession: jest.fn(),
  clearBiometricSession: jest.fn(),
}));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));

describe('offerBiometricSetup', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not ask again when Face ID is already enabled', async () => {
    (isBiometricEnabled as jest.Mock).mockResolvedValue(true);
    const alert = jest.spyOn(Alert, 'alert');

    await expect(offerBiometricSetup(12)).resolves.toBe(true);
    expect(alert).not.toHaveBeenCalled();
  });
});
