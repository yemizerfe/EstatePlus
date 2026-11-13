import { apiClient } from './client';
import type { User } from '../types';

interface UserUpdateData {
  firstName?: string;
  lastName?: string;
  role?: User['role'];
  isActive?: boolean;
}

interface UserSearchQuery {
  page?: number;
  limit?: number;
  role?: User['role'];
  search?: string;
}

export interface MyProfile extends User {
  authProvider: string;
  googleId: string | null;
  passwordHash: string | null;
  profilePicture: string | null;
}

export async function getMyProfile(): Promise<MyProfile> {
  const { data } = await apiClient.get<{ data: MyProfile }>('/users/me');
  return data.data;
}

export async function updateMyProfile(profile: Pick<UserUpdateData, 'firstName' | 'lastName'>): Promise<MyProfile> {
  const { data } = await apiClient.patch<{ data: MyProfile }>('/users/me', profile);
  return data.data;
}

export async function uploadMyAvatar(file: File): Promise<{ profilePicture: string }> {
  const formData = new FormData();
  formData.append('avatar', file);
  const { data } = await apiClient.post<{ data: { profilePicture: string } }>('/users/me/avatar', formData);
  return data.data;
}

export async function removeMyAvatar(): Promise<MyProfile> {
  const { data } = await apiClient.patch<{ data: MyProfile }>('/users/me', { profilePicture: null });
  return data.data;
}

export async function changeMyPassword(passwords: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  await apiClient.post('/users/me/change-password', passwords);
}

// Get users (admin only)
export async function getUsers(query?: UserSearchQuery): Promise<User[]> {
  const { data } = await apiClient.get<{ data: User[] }>('/users', { params: query });
  return data.data!;
}

// Get user by ID
export async function getUser(id: string): Promise<User> {
  const { data } = await apiClient.get<{ data: User }>(`/users/${id}`);
  return data.data!;
}

// Update user
export async function updateUser(id: string, userData: UserUpdateData): Promise<User> {
  const { data } = await apiClient.patch<{ data: User }>(`/users/${id}`, userData);
  return data.data!;
}

// Delete user (admin only)
export async function deleteUser(id: string): Promise<void> {
  await apiClient.delete(`/users/${id}`);
}

// Update profile
export async function updateProfile(userData: UserUpdateData): Promise<User> {
  const { data } = await apiClient.patch<{ data: User }>('/users/profile', userData);
  return data.data!;
}

// Update avatar
export async function updateAvatar(file: File): Promise<User> {
  const formData = new FormData();
  formData.append('avatar', file);
  
  const { data } = await apiClient.patch<{ data: User }>('/users/avatar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  
  return data.data!;
}

// Change password
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiClient.post('/users/change-password', { currentPassword, newPassword });
}

// Get user statistics
export async function getUserStatistics(): Promise<any> {
  const { data } = await apiClient.get<{ data: any }>('/users/statistics');
  return data.data!;
}

// Search users
export async function searchUsers(query: {
  search: string;
  role?: string;
  limit?: number;
}): Promise<User[]> {
  const { data } = await apiClient.get<{ data: User[] }>('/users/search', { params: query });
  return data.data!;
}