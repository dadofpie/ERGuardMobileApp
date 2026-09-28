import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Linking, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmergencySection } from '@/components/home/emergency-section';
import { HeroCard } from '@/components/home/hero-card';
import { HomeHeader } from '@/components/home/home-header';
import { QuickServices } from '@/components/home/quick-services';
import { CUSTOMER_SERVICE_NUMBER, CUSTOMER_SERVICE_TEL } from '@/constants/contact';
import { PURCHASE_ENABLED } from '@/constants/flags';
import { colors, spacing } from '@/constants/theme';
import { legalUrl } from '@/constants/legal';
import { api } from '@/lib/api';
import { useAppConfig } from '@/lib/use-app-config';
import { useAuth } from '@/providers/auth-provider';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { account, token, isPreview } = useAuth();

  const configQuery = useAppConfig();
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
      />

      <HeroCard
        hasCard={hasCard}
        cardLabel={hasCard ? cards[0]?.er_guard_type : undefined}
        artwork={hasCard ? cards[0]?.artwork_type : undefined}
        designKey={hasCard ? cards[0]?.card_design_key : undefined}
        maskedNumber={hasCard ? cards[0]?.card_number_masked : undefined}
        onActivate={() => router.push('/(tabs)/cards')}
        onBuy={() => router.push('/buy')}
      />

      <QuickServices
        services={[
          {
            key: 'hospital',
            title: 'Request LOA',
            subtitle: 'Emergency visit',
            icon: 'document-text',
            tint: '#FFE8E6',
            onPress: () => router.push('/(tabs)/claims'),
          },
          ...(configQuery.data?.feature_flags?.invoice_claims_enabled
            ? [
                {
                  key: 'reimbursement',
                  title: 'File reimbursement',
                  subtitle: 'Invoice claim',
                  icon: 'receipt' as const,
                  tint: '#FFF0EE',
                  onPress: () => router.push('/(tabs)/claims'),
                },
              ]
            : []),
          {
            key: 'customer-service',
            title: 'Customer Service',
            subtitle: `24/7 • ${CUSTOMER_SERVICE_NUMBER}`,
            icon: 'headset',
            tint: '#FFF0EE',
            onPress: () => Linking.openURL(CUSTOMER_SERVICE_TEL),
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
                legalUrl('coverage', configQuery.data?.legal_urls?.coverage_terms_url),
              ),
          },
        ]}
      />

      <EmergencySection
        onFindEr={() => router.push('/(tabs)/claims')}
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
