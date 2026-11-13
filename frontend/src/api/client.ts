import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

// Exported so individual requests (e.g. multipart uploads) can bypass the
// instance-level JSON Content-Type default.
export const BASE_URL = import.meta.env['VITE_API_BASE_URL'] as string ?? '/api/v1';

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // Send HTTP-only cookies with every request
});


let refreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

// Public pages where a failed refresh must NOT force a redirect
const PUBLIC_PAGE_PATTERN = /^\/(login|register|forgot-password|onboarding)(\/|$)/;

// Auth endpoints whose own 401 means "not authenticated" — never refresh or
// redirect because of them.
const isAuthEndpoint = (url?: string): boolean => !!url && url.includes('/auth/');

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (
      error.response?.status !== 401 ||
      original._retry ||
      isAuthEndpoint(original?.url)
    ) {
      return Promise.reject(error);
    }

    if (refreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push((token) => {
          if (token) {
            resolve(apiClient(original));
          } else {
            reject(error);
          }
        });
      });
    }

    refreshing = true;
    original._retry = true;

    try {
      // Refresh token is in HTTP-only cookie, no need to send it manually
      const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true });
      const newToken = (data as { data: { accessToken: string } }).data.accessToken;
      refreshQueue.forEach((cb) => cb(newToken));
      refreshQueue = [];
      return apiClient(original);
    } catch {
      refreshQueue.forEach((cb) => cb(null));
      refreshQueue = [];
      clearAuth();
      // Only bounce to /login when the user is on a protected page; on public
      // pages (home, login, register…) let the UI handle the signed-out state.
      const { pathname } = window.location;
      const onPublicPage = pathname === '/' || PUBLIC_PAGE_PATTERN.test(pathname);
      if (!onPublicPage) {
        window.location.replace('/login');
      }
      return Promise.reject(error);
    } finally {
      refreshing = false;
    }
  },
);

export function clearAuth(): void {
  // Cookies are HTTP-only, so we just redirect to login
  // The backend will clear cookies on logout
}