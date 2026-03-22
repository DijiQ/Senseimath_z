'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: true,
      setUser: (user) => set({ user, isLoading: false }),
      setLoading: (loading) => set({ isLoading: loading }),
      logout: () => set({ user: null, isLoading: false })
    }),
    {
      name: 'senseimath-auth',
      partialize: (state) => ({ user: state.user })
    }
  )
);

// Hook to fetch current user
export function useAuth() {
  const { user, isLoading, setUser, setLoading, logout } = useAuthStore();

  const fetchUser = async () => {
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
    }
  };

  const login = async (email: string, password: string) => {
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
      const error = await response.json();
      return { success: false, error: error.error };
    }
  };

  const register = async (email: string, username: string, password: string, name: string, role: 'TUTOR' | 'STUDENT') => {
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
    fetchUser,
    login,
    register,
    logout: logoutUser
  };
}
