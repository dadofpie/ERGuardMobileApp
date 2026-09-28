import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Linking, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmergencySection } from '@/components/home/emergency-section';
import { HeroCard } from '@/components/home/hero-card';
import { HomeHeader } from '@/components/home/home-header';
import { QuickServices } from '@/components/home/quick-services';
import { PURCHASE_ENABLED } from '@/constants/flags';
import { colors, spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { account, token, isPreview } = useAuth();

  const configQuery = useQuery({ queryKey: ['config'], queryFn: api.getConfig, retry: false });
  const cardsQuery = useQuery({
    queryKey: ['cards', token],
    queryFn: () => api.getCards(token!),
    enabled: !!token && !isPreview,
    retry: false,
  });

  const cards = cardsQuery.data ?? [];
  const hasCard = cards.length > 0;
  const firstName = account?.first_name || 'Member';
  const displayName = [account?.first_name, account?.last_name?.[0]]
    .filter(Boolean)
    .join(' ')
    .trim();

  return (
    <ScrollView
      refreshControl={
        <RefreshControl refreshing={cardsQuery.isFetching} onRefresh={() => cardsQuery.refetch()} />
      }
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 100 },
      ]}
      showsVerticalScrollIndicator={false}>
      <HomeHeader
        firstName={firstName}
        displayName={displayName ? `${displayName}.` : firstName}
        erHotline={configQuery.data?.emergency?.er_hotline}
      />

      <HeroCard
        hasCard={hasCard}
        cardLabel={hasCard ? cards[0]?.er_guard_type : undefined}
        artwork={hasCard ? cards[0]?.artwork_type : undefined}
        maskedNumber={hasCard ? cards[0]?.card_number_masked : undefined}
        onActivate={() => router.push('/(tabs)/cards')}
        onBuy={() => router.push('/buy')}
      />

      <QuickServices
        services={[
          {
            key: 'hospital',
            title: 'Find Hospital',
            subtitle: '1,500+ ER branches',
            icon: 'medical',
            tint: '#FFE8E6',
            onPress: () => router.push('/(tabs)/hospitals'),
          },
          {
            key: 'emergency',
            title: 'Emergency Call',
            subtitle: 'Hotline dispatch',
            icon: 'alert-circle',
            tint: '#FFF0EE',
            onPress: () =>
              Linking.openURL(
                `tel:${(configQuery.data?.emergency?.er_hotline || '0288883748').replace(/\s+/g, '')}`,
              ),
          },
          ...(PURCHASE_ENABLED
            ? [
                {
                  key: 'buy',
                  title: 'Buy a Card',
                  subtitle: 'Prepaid from ₱970',
                  icon: 'card' as const,
                  tint: '#FFF5EB',
                  onPress: () => router.push('/buy'),
                },
              ]
            : []),
          {
            key: 'guide',
            title: 'How It Works',
            subtitle: 'ER Guidebook',
            icon: 'book-outline',
            tint: '#F3F4F6',
            onPress: () =>
              WebBrowser.openBrowserAsync(
                configQuery.data?.legal_urls?.coverage_terms_url || 'https://medicareplus.com.ph',
              ),
          },
        ]}
      />

      <EmergencySection
        nationalHotline={configQuery.data?.emergency?.national_hotline}
        onFindEr={() => router.push('/(tabs)/hospitals')}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    gap: spacing.lg,
  },
});
