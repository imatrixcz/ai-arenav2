import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { authApi, setAuthToken } from '../api/client';
import type { User, MembershipInfo } from '../types';

interface AuthContextType {
  user: User | null;
  memberships: MembershipInfo[];
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; displayName: string; invitationToken?: string }) => Promise<void>;
  loginWithTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const ACCESS_TOKEN_KEY = 'lastsaas_access_token';
const REFRESH_TOKEN_KEY = 'lastsaas_refresh_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<MembershipInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  const clearAuth = useCallback(() => {
    setUser(null);
    setMemberships([]);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    setAuthToken(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const data = await authApi.getMe();
      setUser(data.user);
      setMemberships(data.memberships);
    } catch {
      clearAuth();
    }
  }, [clearAuth]);

  const loginWithTokens = useCallback(async (accessToken: string, refreshToken: string) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    setAuthToken(accessToken);
    await refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authApi.login({ email, password });
    localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    setAuthToken(data.accessToken);
    setUser(data.user);
    setMemberships(data.memberships);
  }, []);

  const register = useCallback(async (data: { email: string; password: string; displayName: string; invitationToken?: string }) => {
    const res = await authApi.register(data);
    localStorage.setItem(ACCESS_TOKEN_KEY, res.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, res.refreshToken);
    setAuthToken(res.accessToken);
    setUser(res.user);
    setMemberships(res.memberships);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    try {
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch {
      // ignore logout errors
    }
    clearAuth();
  }, [clearAuth]);

  // Restore session on mount
  useEffect(() => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (token) {
      setAuthToken(token);
      refreshUser().finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [refreshUser]);

  return (
    <AuthContext.Provider value={{ user, memberships, isAuthenticated, isLoading, login, register, loginWithTokens, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
