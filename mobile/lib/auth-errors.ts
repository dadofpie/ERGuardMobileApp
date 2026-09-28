import { Alert } from 'react-native';
import { router } from 'expo-router';

export type ApiError = Error & { status?: number; field?: string; code?: string };

export function asApiError(error: unknown): ApiError {
  if (error instanceof Error) return error as ApiError;
  return new Error(typeof error === 'string' ? error : 'Request failed');
}

export function isExistingAccountError(error: ApiError) {
  return (
    error.code === 'existing_card_account' ||
    error.code === 'existing_account' ||
    /already exists/i.test(error.message)
  );
}

export function promptExistingAccount(error: ApiError, email?: string) {
  const goLogin = () =>
    router.replace({
      pathname: '/(public)/sign-in',
      params: email ? { email } : undefined,
    });
  Alert.alert('Account already exists', error.message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Log in', onPress: goLogin },
  ]);
}
