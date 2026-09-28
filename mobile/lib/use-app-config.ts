import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';

/**
 * Shared app-config query. Remote config (hotlines, feature flags, legal
 * URLs) changes rarely, so it stays fresh for 5 minutes and is cached for the
 * whole session — one observer + network policy instead of every screen
 * declaring its own `useQuery(['config'])` with the 30s default.
 */
export function useAppConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: api.getConfig,
    retry: false,
    staleTime: 5 * 60_000,
    gcTime: 24 * 60 * 60_000,
  });
}
