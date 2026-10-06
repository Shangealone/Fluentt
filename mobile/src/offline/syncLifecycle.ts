import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { isAccountCurrent, loadAuthenticatedAccount, subscribeToAuthenticatedAccount } from '../auth/tokenStore';
import { resumeAuthPausedReviews } from './queueTransitions';
import { checkServerReachability, drainReviewQueue, getSyncOnlineStatus, setSyncOnlineStatus } from './syncWorker';

export const SYNC_POLL_MS = 30_000;

/** External lifecycle sources are injectable; tests exercise the real queue/worker. */
export interface SyncLifecycleSources {
  isActive: () => boolean;
  subscribeActive: (listener: (active: boolean) => void) => () => void;
  subscribeOnline: (listener: (online: boolean) => void) => () => void;
  every: (listener: () => void, milliseconds: number) => () => void;
}

const nativeSources: SyncLifecycleSources = {
  isActive: () => AppState.currentState === 'active',
  subscribeActive: (listener) => {
    const subscription = AppState.addEventListener('change', (state) => listener(state === 'active'));
    return () => subscription.remove();
  },
  subscribeOnline: (listener) => NetInfo.addEventListener((state) => {
    listener(Boolean(state.isConnected && state.isInternetReachable !== false));
  }),
  every: (listener, milliseconds) => {
    const timer = setInterval(listener, milliseconds);
    timer.unref?.();
    return () => clearInterval(timer);
  },
};

/** One mounted foreground coordinator. There is no background task scheduler. */
export function startSyncLifecycle(sources = nativeSources): () => void {
  let active = sources.isActive();
  let stopped = false;
  let running = false;
  let requested = false;
  let verifiedSession: string | null = null;

  async function run(): Promise<void> {
    if (running || stopped) return;
    running = true;
    try {
      do {
        requested = false;
        if (!active || stopped || !getSyncOnlineStatus()) continue;
        const account = await loadAuthenticatedAccount();
        if (!account || !isAccountCurrent(account) || stopped || !active) continue;
        const session = `${account.userId}:${account.generation}`;
        if (session !== verifiedSession) {
          // Identity is verified after startup/login/token rotation. Never use
          // health/resume/manual transport retries to clear an authorization pause.
          await resumeAuthPausedReviews(account.userId);
          verifiedSession = session;
        }
        if (!isAccountCurrent(account) || stopped || !active) continue;
        if (!await checkServerReachability()) continue;
        if (!isAccountCurrent(account) || stopped || !active) continue;
        await drainReviewQueue(account, () => !stopped && active);
      } while (requested && !stopped);
    } catch (error) {
      // Durable rows remain intact on storage/probe failure. The next foreground
      // tick retries initialization; no volatile replacement store is created.
      console.warn('Review synchronization lifecycle failed:', error);
    } finally {
      running = false;
    }
  }
  function request(): void {
    requested = true;
    void run();
  }
  const unsubscribeAccount = subscribeToAuthenticatedAccount(request);
  const unsubscribeActive = sources.subscribeActive((value) => { active = value; if (active) request(); });
  const unsubscribeOnline = sources.subscribeOnline((value) => { setSyncOnlineStatus(value); if (value) request(); });
  const cancelPoll = sources.every(request, SYNC_POLL_MS);
  request(); // Already-verified startup; unverified startup waits for /users/me.
  return () => {
    stopped = true;
    unsubscribeAccount(); unsubscribeActive(); unsubscribeOnline(); cancelPoll();
  };
}
