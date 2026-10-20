import { create } from 'zustand';
import { refreshSession, setAccessToken, setAuthLostHandler } from '@/lib/api/client';
import { authApi, type LoginResponse } from '@/lib/api/endpoints';
import { ensureDeviceKey } from '@/lib/auth/device-key';
import { clearKeyring } from '@/lib/crypto';
import { getQueryClient } from '@/lib/query-client';
import { realtime } from '@/lib/ws/client';
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
  hydrate: () => Promise<void>;
  signIn: (res: LoginResponse) => Promise<void>;
  signOut: () => Promise<void>;
  clearLocal: () => void;
}

export const useSession = create<SessionState>((set, get) => {
  const prepareKeys = async (user: User) => {
    if (user.role !== 'user') return set({ keyReady: true });
    try {
      const fingerprint = await ensureDeviceKey(user);
      set({ keyReady: true, fingerprint, keyError: null });
    } catch {
      set({ keyReady: false, keyError: 'Could not set up this device’s encryption key.' });
    }
  };

  return {
    user: null,
    status: 'idle',
    keyReady: false,
    fingerprint: null,
    keyError: null,

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

    signOut: async () => {
      try {
        await authApi.logout();
      } catch {
        /* still clear local state */
      }
      get().clearLocal();
    },

    clearLocal: () => {
      realtime.stop();
      setAccessToken(null);
      clearKeyring();
      useChatStore.getState().reset();
      getQueryClient().clear();
      set({ user: null, status: 'anonymous', keyReady: false, fingerprint: null, keyError: null });
    },
  };
});

setAuthLostHandler(() => useSession.getState().clearLocal());
