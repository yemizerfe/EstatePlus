import type { User } from '../types';

// Simple Zustand-like store using React context pattern
// (keeping dependency-light — using localStorage + Context)

export function getUserFromStorage(): User | null {
  try {
    const raw = localStorage.getItem('user');
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function setUserInStorage(user: User | null): void {
  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
  } else {
    localStorage.removeItem('user');
  }
}

export function isTokenValid(): boolean {
  const token = localStorage.getItem('access_token');
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]!)) as { exp: number };
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}
