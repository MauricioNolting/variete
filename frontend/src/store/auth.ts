import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Client, UserRole } from '../types';

interface AuthStore {
  role: UserRole | null;
  client: Client | null;
  adminId: number | null;
  token: string | null;
  setAuth: (role: UserRole, client: Client | null, adminId: number | null, token?: string) => void;
  updateClient: (client: Client) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      role: null,
      client: null,
      adminId: null,
      token: null,
      setAuth: (role, client, adminId, token) => {
        if (token) localStorage.setItem('variete_token', token);
        set({ role, client, adminId, token: token || null });
      },
      updateClient: (client) => set({ client }),
      clearAuth: () => {
        localStorage.removeItem('variete_token');
        set({ role: null, client: null, adminId: null, token: null });
      },
    }),
    { name: 'variete_auth' }
  )
);
