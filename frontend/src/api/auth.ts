import { apiClient, clearAuth } from './client';
import type { User, AuthTokens } from '../types';

export async function login(email: string, password: string): Promise<{ user: User; tokens: AuthTokens }> {
  const { data } = await apiClient.post<{ data: AuthTokens }>('/auth/login', { email, password });
  const tokens = data.data!;
  const profile = await getProfile();
  return { user: profile, tokens };
}

export async function register(payload: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  accountType?: 'user' | 'property_owner';
}): Promise<User> {
  const { data } = await apiClient.post<{ data: User }>('/auth/register', payload);
  return data.data!;
}

export async function logout(): Promise<void> {
  // Refresh token is in HTTP-only cookie, backend will read it from cookie
  await apiClient.post('/auth/logout', {}).catch(() => {});
  clearAuth();
}

export async function getProfile(): Promise<User> {
  const { data } = await apiClient.get<{ data: User }>('/auth/profile');
  return data.data!;
}