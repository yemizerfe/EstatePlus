import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { login as apiLogin, logout as apiLogout, getProfile } from '../api/auth';
import { getUserFromStorage, setUserInStorage, isTokenValid } from '../store/authStore';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getUserFromStorage());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      if (isTokenValid()) {
        try {
          const profile = await getProfile();
          setUser(profile);
          setUserInStorage(profile);
        } catch {
          setUser(null);
          setUserInStorage(null);
        }
      } else {
        setUser(null);
        setUserInStorage(null);
      }
      setIsLoading(false);
    };
    void init();
  }, []);

  const login = async (email: string, password: string) => {
    const { user: profile } = await apiLogin(email, password);
    setUser(profile);
    setUserInStorage(profile);
  };

  const logout = async () => {
    await apiLogout();
    setUser(null);
    setUserInStorage(null);
  };

  const refreshUser = async () => {
    const profile = await getProfile();
    setUser(profile);
    setUserInStorage(profile);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
