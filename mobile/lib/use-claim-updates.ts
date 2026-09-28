import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { api } from '@/lib/api';

/**
 * Server-push claim updates without polling.
 *
 * The ticketing backend holds `pollClaimUpdates` open until one of this
 * member's tickets changes (or the timeout elapses) and the loop re-issues
 * immediately — so history refreshes seconds after staff update a ticket,
 * with no interval timer. Phones cannot receive inbound webhooks, so the
 * held request is the push channel. Returning to the foreground also
 * triggers a refresh to cover gaps while the app was suspended.
 */
export function useClaimUpdates({
  token,
  enabled,
  onChanged,
}: {
  token: string | null;
  enabled: boolean;
  onChanged: () => void;
}) {
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

  useEffect(() => {
    if (!token || !enabled) return;
    let stopped = false;
    let controller: AbortController | null = null;
    let backoffMs = 0;

    const foregroundSub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !stopped) onChangedRef.current();
    });

    const loop = async () => {
      while (!stopped) {
        controller = new AbortController();
        try {
          const changed = await api.pollClaimUpdates(token, 25, controller.signal);
          backoffMs = 0;
          if (stopped) return;
          if (changed.length) onChangedRef.current();
        } catch {
          if (stopped) return;
          // Error backoff only (not a poll cadence): network or proxy hiccup.
          backoffMs = Math.min(backoffMs ? backoffMs * 1.5 : 2000, 15000);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    };
    loop();

    return () => {
      stopped = true;
      controller?.abort();
      foregroundSub.remove();
    };
  }, [token, enabled]);
}
