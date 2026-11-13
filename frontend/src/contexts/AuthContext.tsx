import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { login as apiLogin, logout as apiLogout, getProfile } from '../api/auth';

export type UserRole = 'USER' | 'PROPERTY_OWNER' | 'ANALYST' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  firstName?: string;
  lastName?: string;
  /** Minutes of inactivity before the client signs the session out. */
  sessionTimeout?: number;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User | null) => void;
}

// Maps backend role strings (lowercase) to frontend role strings (uppercase)
const roleMap: Record<string, UserRole> = {
  user: 'USER',
  property_owner: 'PROPERTY_OWNER',
  analyst: 'ANALYST',
  admin: 'ADMIN',
};

function normalizeUser(profile: any): User {
  const rawRole = (profile?.role || 'user').toLowerCase();
  return {
    id: profile.id,
    name: [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.email,
    email: profile.email,
    role: roleMap[rawRole] || 'USER',
    // Only set avatar if it's a valid URL/path, not null or empty
    avatar: (profile.profilePicture && profile.profilePicture !== 'null' && profile.profilePicture.trim() !== '') 
           ? profile.profilePicture 
           : (profile.avatar && profile.avatar !== 'null' && profile.avatar.trim() !== '') 
           ? profile.avatar 
           : undefined,
    firstName: profile.firstName,
    lastName: profile.lastName,
    sessionTimeout:
      typeof profile?.securitySettings?.sessionTimeout === 'number'
        ? profile.securitySettings.sessionTimeout
        : undefined,
  };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

/** Maximum number of retry attempts for the initial session check. */
const MAX_AUTH_RETRIES = 3;

/** Fallback idle limit when a profile carries no saved preference. */
const DEFAULT_SESSION_TIMEOUT = 30;

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session by calling /auth/profile
    // The access_token is in an HTTP-only cookie, so we just need to call the API
    // Retry with backoff so that a briefly unavailable backend (e.g. during a
    // tsx-watch restart) does not falsely show the user as logged-out.
    const checkAuth = async (attempt = 0): Promise<void> => {
      try {
        const profile = await getProfile();
        setUser(normalizeUser(profile));
      } catch (error: any) {
        const status = error?.response?.status;
        // 401 / 403 → user is genuinely not authenticated; stop retrying.
        // Network errors (ECONNREFUSED, proxy 502, etc.) → retry a few times.
        if (status === 401 || status === 403) {
          setUser(null);
        } else if (attempt < MAX_AUTH_RETRIES) {
          const delay = Math.pow(2, attempt) * 1000;
          setTimeout(() => checkAuth(attempt + 1), delay);
          return;
        } else {
          setUser(null);
        }
      } finally {
        if (attempt === 0 || attempt === MAX_AUTH_RETRIES) {
          setIsLoading(false);
        }
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const { user: profile } = await apiLogin(email, password);
    setUser(normalizeUser(profile));
  };

  const logout = () => {
    apiLogout().catch(() => {});
    setUser(null);
  };

  // Honor the "Session Timeout" preference saved in the profile screens: after
  // that many idle minutes the local session is dropped and the user is sent
  // back to the sign-in page.
  const sessionTimeout = user?.sessionTimeout;
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;

    const minutes = Math.max(5, sessionTimeout ?? DEFAULT_SESSION_TIMEOUT);
    const limitMs = minutes * 60 * 1000;
    const activityEvents: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
    ];
    let timer = 0;

    const expire = () => {
      apiLogout().catch(() => {});
      setUser(null);
      // Only the signed-in areas need a bounce to the sign-in page; a reader
      // idling on a public page is simply signed out in place.
      if (/^\/(app|admin)(\/|$)/.test(window.location.pathname)) {
        window.location.replace('/login?reason=session-timeout');
      }
    };

    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(expire, limitMs);
    };

    activityEvents.forEach((event) =>
      window.addEventListener(event, reset, { passive: true }),
    );
    reset();

    return () => {
      window.clearTimeout(timer);
      activityEvents.forEach((event) => window.removeEventListener(event, reset));
    };
  }, [userId, sessionTimeout]);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};