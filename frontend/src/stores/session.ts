import { create } from 'zustand';
import { ApiError, refreshSession, setAccessToken, setAuthLostHandler } from '@/lib/api/client';
import { authApi, type LoginResponse } from '@/lib/api/endpoints';
import { ensureDeviceKey, resetDeviceKey } from '@/lib/auth/device-key';
import { clearKeyring } from '@/lib/crypto';
import { getQueryClient } from '@/lib/query-client';
import type { User } from '@/types';
import { useChatStore } from './chat';

type Status = 'idle' | 'loading' | 'authenticated' | 'anonymous';

interface SessionState {
  user: User | null;
  status: Status;
  /** Device key present + registered — chat features wait on this. */
  keyReady: boolean;
  fingerprint: string | null;
  keyError: string | null;
  keyResetRequired: boolean;
  keyResetting: boolean;
  hydrate: () => Promise<void>;
  signIn: (res: LoginResponse) => Promise<void>;
  acceptClerkUser: (user: User) => Promise<void>;
  retryKeySetup: () => Promise<void>;
  recoverDeviceKey: () => Promise<boolean>;
  signOut: () => Promise<void>;
  clearLocal: () => void;
}

export const useSession = create<SessionState>((set, get) => {
  const prepareKeys = async (user: User) => {
    if (user.role !== 'user') return set({ keyReady: true, keyResetRequired: false });
    try {
      const fingerprint = await ensureDeviceKey(user);
      set({ keyReady: true, fingerprint, keyError: null, keyResetRequired: false });
    } catch (error) {
      const keyResetRequired = error instanceof ApiError && error.code === 'KEY_ALREADY_REGISTERED';
      set({
        keyReady: false,
        keyError: keyResetRequired
          ? 'This browser has a different key from the one currently registered to your account.'
          : 'Could not set up this device’s encryption key. Check that browser storage is enabled, then try again.',
        keyResetRequired,
      });
    }
  };

  return {
    user: null,
    status: 'idle',
    keyReady: false,
    fingerprint: null,
    keyError: null,
    keyResetRequired: false,
    keyResetting: false,

    hydrate: async () => {
      if (get().status !== 'idle') return;
      set({ status: 'loading' });
      const res = await refreshSession();
      if (!res) return set({ status: 'anonymous' });
      set({ user: res.user, status: 'authenticated' });
      await prepareKeys(res.user);
    },

    signIn: async (res) => {
      setAccessToken(res.accessToken);
      set({ user: res.user, status: 'authenticated' });
      await prepareKeys(res.user);
    },

    acceptClerkUser: async (user) => {
      set({ user, status: 'authenticated' });
      await prepareKeys(user);
    },

    retryKeySetup: async () => {
      const user = get().user;
      if (user) await prepareKeys(user);
    },

    recoverDeviceKey: async () => {
      const { user, keyResetRequired } = get();
      if (!user || !keyResetRequired) return false;
      set({ keyResetting: true });
      try {
        const fingerprint = await resetDeviceKey(user);
        clearKeyring();
        set({ keyReady: true, fingerprint, keyError: null, keyResetRequired: false, keyResetting: false });
        return true;
      } catch (error) {
        set({
          keyError: error instanceof Error
            ? `Could not reset this device’s key: ${error.message}`
            : 'Could not reset this device’s key. Try again.',
          keyResetting: false,
        });
        return false;
      }
    },

    signOut: async () => {
      try {
        await authApi.logout();
      } catch {
        /* still clear local state */
      }
      get().clearLocal();
    },

    clearLocal: () => {
      setAccessToken(null);
      clearKeyring();
      useChatStore.getState().reset();
      getQueryClient().clear();
      set({
        user: null,
        status: 'anonymous',
        keyReady: false,
        fingerprint: null,
        keyError: null,
        keyResetRequired: false,
        keyResetting: false,
      });
    },
  };
});

setAuthLostHandler(() => useSession.getState().clearLocal());
