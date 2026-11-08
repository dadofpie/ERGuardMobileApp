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
// The server allows one concurrent long-poll per session (a second gets 429),
// so only a single loop may run at a time across all hook instances.
let activeOwner: symbol | null = null;

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
    if (activeOwner) return;
    const owner = Symbol('claim-poll');
    activeOwner = owner;
    let stopped = false;
    let paused = false;
    let controller: AbortController | null = null;
    let backoffMs = 0;
    let resume: (() => void) | null = null;

    // LOGIC-05: a held long-poll must not keep running while the app is
    // backgrounded (Android keeps JS alive). Abort it on the way out and
    // re-issue one held request when the member returns.
    const waitUntilActive = () =>
      new Promise<void>((resolve) => {
        resume = resolve;
      });

    const foregroundSub = AppState.addEventListener('change', (state) => {
      if (stopped) return;
      if (state === 'active') {
        if (paused) {
          paused = false;
          const resumeLoop = resume;
          resume = null;
          resumeLoop?.();
        }
        onChangedRef.current();
        return;
      }
      paused = true;
      controller?.abort();
    });

    const loop = async () => {
      while (!stopped) {
        if (paused) {
          await waitUntilActive();
          continue;
        }
        controller = new AbortController();
        try {
          const changed = await api.pollClaimUpdates(token, 20, controller.signal);
          backoffMs = 0;
          if (stopped) return;
          if (changed.length) onChangedRef.current();
        } catch (e) {
          if (stopped) return;
          // Backgrounding aborts the held request on purpose; do not treat it
          // as a network failure or rack up backoff.
          if (paused) continue;
          const err = e as { status?: number; retryAfter?: number };
          // Session ended: the global handler already signed the user out.
          if (err?.status === 401) return;
          // Error backoff only (not a poll cadence): network or proxy hiccup.
          backoffMs = Math.min(backoffMs ? backoffMs * 1.5 : 2000, 15000);
          if (err?.status === 429) {
            backoffMs = Math.min(Math.max(backoffMs, (err.retryAfter ?? 0) * 1000, 5000), 60000);
          }
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    };
    loop();

    return () => {
      stopped = true;
      if (activeOwner === owner) activeOwner = null;
      controller?.abort();
      resume?.();
      foregroundSub.remove();
    };
  }, [token, enabled]);
}
