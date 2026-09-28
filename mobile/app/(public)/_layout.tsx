import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/providers/auth-provider';

export default function PublicLayout() {
  const { account, loading } = useAuth();
  if (!loading && account) return <Redirect href="/(tabs)/home" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
