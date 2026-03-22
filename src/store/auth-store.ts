'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  username: string;
  name: string | null;
  role: 'TUTOR' | 'STUDENT';
  avatar: string | null;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  initialized: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
  setInitialized: (initialized: boolean) => void;
}

// Use a module-level variable to prevent re-fetching across renders
let hasInitialized = false;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: true,
      initialized: false,
      setUser: (user) => set({ user, isLoading: false }),
      setLoading: (loading) => set({ isLoading: loading }),
      logout: () => {
        hasInitialized = false;
        set({ user: null, isLoading: false, initialized: false });
      },
      setInitialized: (initialized) => {
        hasInitialized = initialized;
        set({ initialized });
      }
    }),
    {
      name: 'senseimath-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user }),
      onRehydrateStorage: () => (state) => {
        // After rehydration, check if we already have a user
        if (state?.user) {
          hasInitialized = true;
          state.setInitialized(true);
          state.setLoading(false);
        }
      }
    }
  )
);

// Hook to fetch current user
export function useAuth() {
  const { user, isLoading, initialized, setUser, setLoading, logout, setInitialized } = useAuthStore();

  const fetchUser = async () => {
    // Prevent multiple fetches
    if (hasInitialized) return;
    
    hasInitialized = true;
    setLoading(true);
    
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setInitialized(true);
    }
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (response.ok) {
      const data = await response.json();
      setUser(data.user);
      return { success: true };
    } else {
      setLoading(false);
      const error = await response.json();
      return { success: false, error: error.error };
    }
  };

  const register = async (email: string, username: string, password: string, name: string, role: 'TUTOR' | 'STUDENT') => {
    setLoading(true);
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password, name, role })
    });

    if (response.ok) {
      const data = await response.json();
      setUser(data.user);
      return { success: true };
    } else {
      setLoading(false);
      const error = await response.json();
      return { success: false, error: error.error };
    }
  };

  const logoutUser = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    logout();
  };

  return {
    user,
    isLoading,
    initialized,
    fetchUser,
    login,
    register,
    logout: logoutUser
  };
}
