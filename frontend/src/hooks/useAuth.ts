import { create } from 'zustand';
import { authApi } from '@/services/api';

interface User {
  id: string; email: string; firstName: string; lastName: string; role: string; organizationId: string | null;
}

interface Org {
  id: string; name: string; tier: string; maxUsers: number; maxClients: number;
}

interface AuthState {
  user: User | null;
  organization: Org | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  organization: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email, password) => {
    const { data } = await authApi.login(email, password);
    localStorage.setItem('accessToken', data.tokens.accessToken);
    localStorage.setItem('refreshToken', data.tokens.refreshToken);
    set({ user: data.user, organization: data.organization, isAuthenticated: true });
  },

  register: async (data) => {
    const { data: res } = await authApi.register(data);
    localStorage.setItem('accessToken', res.tokens.accessToken);
    localStorage.setItem('refreshToken', res.tokens.refreshToken);
    set({ user: res.user, organization: res.organization, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    set({ user: null, organization: null, isAuthenticated: false });
  },

  loadUser: async () => {
    try {
      const { data } = await authApi.me();
      set({ user: data.user, organization: data.organization, isAuthenticated: true, isLoading: false });
    } catch {
      set({ isLoading: false, isAuthenticated: false });
    }
  },
}));