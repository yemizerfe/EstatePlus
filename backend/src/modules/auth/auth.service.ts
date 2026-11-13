import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { Response } from 'express';

import { config } from '../../config';
import { prisma } from '../../infrastructure/database/prisma';
import { JwtPayload, UserRole } from '../../shared/types';
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../shared/utils/errors';
import { logger } from '../../shared/utils/logger';
import { notificationService } from '../notifications/notifications.service';

/** Subset of the Microsoft Graph `/me` payload this service consumes. */
interface MicrosoftProfile {
  id: string;
  mail?: string | null;
  userPrincipalName?: string | null;
  givenName?: string | null;
  surname?: string | null;
}

export interface RegisterDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  accountType?: 'user' | 'property_owner';
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface SecuritySettings {
  emailNotifications: boolean;
  loginAlerts: boolean;
  sessionTimeout: number;
  /** Keeps the shape assignable to Prisma's JSON column input type. */
  [key: string]: boolean | number;
}

const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  emailNotifications: true,
  loginAlerts: true,
  sessionTimeout: 30,
};

/** Coerce the stored JSON blob into the shape the UI expects. */
function normalizeSecuritySettings(value: unknown): SecuritySettings {
  const stored = (value ?? {}) as Partial<SecuritySettings>;
  return {
    emailNotifications:
      typeof stored.emailNotifications === 'boolean'
        ? stored.emailNotifications
        : DEFAULT_SECURITY_SETTINGS.emailNotifications,
    loginAlerts:
      typeof stored.loginAlerts === 'boolean'
        ? stored.loginAlerts
        : DEFAULT_SECURITY_SETTINGS.loginAlerts,
    sessionTimeout:
      typeof stored.sessionTimeout === 'number' && stored.sessionTimeout >= 5
        ? stored.sessionTimeout
        : DEFAULT_SECURITY_SETTINGS.sessionTimeout,
  };
}

export interface ForgotPasswordDto {
  email: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

const prismaUserRoleMap: Record<UserRole, 'USER' | 'PROPERTY_OWNER' | 'ANALYST' | 'ADMIN'> = {
  user: 'USER',
  property_owner: 'PROPERTY_OWNER',
  analyst: 'ANALYST',
  admin: 'ADMIN',
};

const prismaToAppUserRole: Record<string, UserRole> = {
  USER: 'user',
  PROPERTY_OWNER: 'property_owner',
  ANALYST: 'analyst',
  ADMIN: 'admin',
};

const prismaAuthProviderMap: Record<'local' | 'google', 'LOCAL' | 'GOOGLE'> = {
  local: 'LOCAL',
  google: 'GOOGLE',
};

const prismaToAppAuthProvider: Record<string, 'local' | 'google'> = {
  LOCAL: 'local',
  GOOGLE: 'google',
};

function toPrismaUserRole(role: UserRole) {
  return prismaUserRoleMap[role];
}

function normalizeUserRole(role: string | null | undefined): UserRole {
  return prismaToAppUserRole[role ?? ''] ?? 'user';
}

function toPrismaAuthProvider(provider: 'local' | 'google') {
  return prismaAuthProviderMap[provider];
}

function normalizeAuthProvider(provider: string | null | undefined): 'local' | 'google' {
  return prismaToAppAuthProvider[provider ?? ''] ?? 'local';
}

// ─── Cookie Helpers ────────────────────────────────────────────────────────────
const isProd = config.NODE_ENV === 'production';

export function setAuthCookies(res: Response, tokens: AuthTokens): void {
  res.cookie('access_token', tokens.accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: tokens.expiresIn * 1000, // 15 min
    path: '/',
  });
  res.cookie('refresh_token', tokens.refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie('access_token', { httpOnly: true, secure: isProd, sameSite: isProd ? 'none' : 'lax', path: '/' });
  res.clearCookie('refresh_token', { httpOnly: true, secure: isProd, sameSite: isProd ? 'none' : 'lax', path: '/' });
}

function generateAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

export async function register(dto: RegisterDto) {
  const existing = await prisma.user.findUnique({ where: { email: dto.email } });
  if (existing) throw new ConflictError('An account with this email already exists. Please sign in instead.');

  const passwordHash = await argon2.hash(dto.password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  // Determine user role: only allow 'user' or 'property_owner' from signup
  // Admin and analyst roles must be assigned by administrators
  const role = dto.accountType === 'property_owner' ? 'property_owner' : 'user';

  const user = await prisma.user.create({
    data: {
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: toPrismaUserRole(role),
    },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, createdAt: true },
  });

  logger.info({ msg: 'User registered', userId: user.id, role });

  // Welcome notification so the bell has something real on first sign-in
  notificationService
    .createNotification({
      userId: user.id,
      type: 'SYSTEM',
      title: 'Welcome to EstatePlus 👋',
      body: 'Explore market trends, save properties and track prices across Addis Ababa.',
      link: '/explore',
    })
    .catch((err) => logger.warn({ msg: 'Failed to create welcome notification', err }));

  return user;
}

export async function login(dto: LoginDto): Promise<AuthTokens> {
  const user = await prisma.user.findUnique({ where: { email: dto.email } });
  if (!user || !user.isActive) throw new UnauthorizedError('Invalid credentials');

  // Check if user has a password (not OAuth-only account)
  if (!user.passwordHash) throw new UnauthorizedError('Invalid credentials');

  const valid = await argon2.verify(user.passwordHash, dto.password);
  if (!valid) throw new UnauthorizedError('Invalid credentials');

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const accessToken = generateAccessToken({
    sub: user.id,
    id: user.id,
    email: user.email,
    role: normalizeUserRole(user.role),
  });

  const rawRefresh = generateRefreshToken();
  const tokenHash = crypto.createHash('sha256').update(rawRefresh).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({ data: { userId: user.id, tokenHash, expiresAt } });

  logger.info({ msg: 'User logged in', userId: user.id });

  // "Login alerts" is a real preference: honour it here, and never let a failed
  // notification break the sign-in itself.
  try {
    const settings = normalizeSecuritySettings(user.securitySettings);
    if (settings.loginAlerts) {
      await notificationService.createNotification({
        userId: user.id,
        type: 'SYSTEM',
        title: 'New sign-in to your account',
        body: `Your account was signed in with email and password on ${new Date().toUTCString()} (East Africa Time is UTC+3). If this was not you, change your password now.`,
        link: '/app/profile',
        channels: settings.emailNotifications ? ['IN_APP', 'EMAIL'] : ['IN_APP'],
      });
    }
  } catch (error) {
    logger.warn({
      msg: 'Could not create the login alert notification',
      userId: user.id,
      err: error instanceof Error ? error.message : String(error),
    });
  }

  return { accessToken, refreshToken: rawRefresh, expiresIn: 900 };
}

export async function refreshTokens(rawToken: string): Promise<AuthTokens> {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!stored || stored.expiresAt < new Date()) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user || !user.isActive) throw new UnauthorizedError('User account is inactive');

  // Rotate: delete old, create new
  await prisma.refreshToken.delete({ where: { tokenHash } });

  const accessToken = generateAccessToken({
    sub: user.id,
    id: user.id,
    email: user.email,
    role: normalizeUserRole(user.role),
  });

  const rawRefresh = generateRefreshToken();
  const newHash = crypto.createHash('sha256').update(rawRefresh).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({ data: { userId: user.id, tokenHash: newHash, expiresAt } });

  return { accessToken, refreshToken: rawRefresh, expiresIn: 900 };
}

export async function forgotPassword(dto: ForgotPasswordDto): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: dto.email } });

  // Always return success for security (don't reveal if email exists)
  if (!user || !user.isActive) {
    logger.info({ msg: 'Forgot password attempt for non-existent email', email: dto.email });
    return;
  }

  // Google-auth users never have a local password, so no password reset flow is allowed.
  if (normalizeAuthProvider(user.authProvider) !== 'local' || !user.passwordHash) {
    logger.info({ msg: 'Forgot password blocked for Google-auth account', userId: user.id, email: user.email });
    return;
  }

  // The schema has no reset-token columns and no mail transport is configured,
  // so the request is recorded honestly instead of pretending a mail went out.
  logger.warn({
    msg: 'Password reset requested but reset-token storage / mail transport is not configured',
    userId: user.id,
  });
}

export async function logout(rawToken: string): Promise<void> {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  await prisma.refreshToken.deleteMany({ where: { tokenHash } });
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      authProvider: true,
      googleId: true,
      passwordHash: true,
      profilePicture: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      lastPasswordChange: true,
      securitySettings: true,
    },
  });

  const authProvider = normalizeAuthProvider(user.authProvider) === 'google' || user.googleId || (!user.passwordHash && normalizeAuthProvider(user.authProvider) === 'local')
    ? 'google'
    : 'local';

  // Credentials never leave the server: the hash and the Google subject stay
  // internal, and the response carries only what the interface renders.
  const { passwordHash: _passwordHash, googleId: _googleId, ...safe } = user;

  return {
    ...safe,
    authProvider,
    role: normalizeUserRole(user.role),
    securitySettings: normalizeSecuritySettings(user.securitySettings),
  };
}

/**
 * Verify if email exists and is properly formatted
 */
export async function verifyEmailExists(email: string): Promise<{
  exists: boolean;
  isValid: boolean;
  authProvider?: 'local' | 'google';
  hasLocalPassword?: boolean;
}> {
  // Check basic email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isValid = emailRegex.test(email);

  if (!isValid) {
    return { exists: false, isValid: false };
  }

  // Check if email already exists in database
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, authProvider: true, passwordHash: true },
  });

  if (!user) {
    return { exists: false, isValid: true };
  }

  const authProvider = normalizeAuthProvider(user.authProvider) === 'google' ? 'google' : 'local';

  return {
    exists: true,
    isValid: true,
    authProvider,
    hasLocalPassword: authProvider === 'local' && !!user.passwordHash,
  };
}

/**
 * Encode the post-auth destination (`redirectTo`) and cancel fallback
 * (`backTo`) into an OAuth `state` value together with a random nonce
 * (CSRF protection). The nonce round-trips untouched; only the embedded
 * paths are read back on callback.
 */
export function buildOAuthState(redirectTo?: unknown, backTo?: unknown, intent?: unknown): string {
  const payload = {
    n: crypto.randomBytes(16).toString('hex'),
    r: sanitizeAppPath(redirectTo),
    b: sanitizeAppPath(backTo),
    i: sanitizeIntent(intent),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', config.JWT_SECRET)
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

/**
 * Read destinations out of a signed OAuth state. Only same-app paths survive.
 */
export function readOAuthState(state: unknown): {
  redirectTo: string | null;
  backTo: string | null;
  intent: 'login' | 'register' | null;
  valid: boolean;
} {
  if (typeof state !== 'string' || !state) {
    return { redirectTo: null, backTo: null, intent: null, valid: false };
  }
  try {
    const [encodedPayload, signature, ...extra] = state.split('.');
    if (!encodedPayload || !signature || extra.length > 0) {
      return { redirectTo: null, backTo: null, intent: null, valid: false };
    }

    const expectedSignature = crypto
      .createHmac('sha256', config.JWT_SECRET)
      .update(encodedPayload)
      .digest('base64url');
    const actualSignatureBuffer = Buffer.from(signature);
    const expectedSignatureBuffer = Buffer.from(expectedSignature);
    if (
      actualSignatureBuffer.length !== expectedSignatureBuffer.length
      || !crypto.timingSafeEqual(actualSignatureBuffer, expectedSignatureBuffer)
    ) {
      return { redirectTo: null, backTo: null, intent: null, valid: false };
    }

    const parsed = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as {
      r?: unknown;
      b?: unknown;
      i?: unknown;
    };
    return {
      redirectTo: sanitizeAppPath(parsed.r),
      backTo: sanitizeAppPath(parsed.b),
      intent: sanitizeIntent(parsed.i),
      valid: true,
    };
  } catch {
    return { redirectTo: null, backTo: null, intent: null, valid: false };
  }
}

/** Only allow same-app relative paths (must start with a single `/`). */
function sanitizeAppPath(value: unknown): string | null {
  if (
    typeof value !== 'string'
    || !value.startsWith('/')
    || value.startsWith('//')
    || value.includes('\\')
    || /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return null;
  }
  return value;
}

/** Only allow known auth intents through the OAuth round-trip. */
function sanitizeIntent(value: unknown): 'login' | 'register' | null {
  return value === 'login' || value === 'register' ? value : null;
}

/**
 * Generate Google OAuth URL
 */
export function getGoogleAuthUrl(redirectUri: string, state?: string): string {
  const params = new URLSearchParams({
    client_id: config.GOOGLE_CLIENT_ID || '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
    // Carries origin/destination through the OAuth round-trip
    state: state ?? crypto.randomBytes(16).toString('hex'),
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export type GoogleCallbackResult =
  | { status: 'email_exists'; email: string }
  | { status: 'user_not_found'; email: string }
  | { tokens: AuthTokens; isNewUser: boolean };

/**
 * Handle Google OAuth callback
 * @param opts.intent 'login' allows linking/logging into an existing account;
 * 'register' refuses emails that already have an account so the caller can
 * show "already registered — please sign in" instead of merging profiles.
 */
export async function handleGoogleCallback(
  code: string,
  redirectUri: string,
  opts: { intent?: 'login' | 'register' | null } = {},
): Promise<GoogleCallbackResult> {
  // Exchange code for tokens
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      client_id: config.GOOGLE_CLIENT_ID,
      client_secret: config.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const tokenData: any = await tokenResponse.json();

  if (!tokenResponse.ok) {
    logger.warn({ msg: 'Google token exchange failed', statusCode: tokenResponse.status });
    throw new UnauthorizedError('OAuth authentication failed');
  }

  // Get user info
  const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  const userInfo: any = await userInfoResponse.json();

  if (!userInfoResponse.ok) {
    logger.warn({ msg: 'Google user info request failed', statusCode: userInfoResponse.status });
    throw new UnauthorizedError('Failed to fetch user information');
  }

  const existingUser = await prisma.user.findUnique({ where: { email: userInfo.email } });

  // A sign-up attempt with an email that already has an account must never
  // create a second account nor silently merge profiles — direct the user to
  // sign in instead.
  if (existingUser && opts.intent === 'register') {
    logger.info({ msg: 'Google sign-up blocked, email already registered', userId: existingUser.id });
    return { status: 'email_exists', email: userInfo.email };
  }

  // Login attempts must not create a brand-new account on the fly. If the user
  // has not signed up yet, send them to the registration flow instead.
  if (!existingUser && opts.intent === 'login') {
    logger.info({ msg: 'Google login rejected for unregistered user' });
    return { status: 'user_not_found', email: userInfo.email };
  }

  let user = existingUser;
  let isNewUser = false;

  if (!user) {
    // Create new user with OAuth only when the intent is to register/signup.
    user = await prisma.user.create({
      data: {
        email: userInfo.email,
        firstName: userInfo.given_name || '',
        lastName: userInfo.family_name || '',
        passwordHash: null,
        role: toPrismaUserRole('user'),
        authProvider: toPrismaAuthProvider('google'),
        googleId: userInfo.id,
      },
    });
    isNewUser = true;
    logger.info({ msg: 'New OAuth user created', userId: user.id, provider: 'google' });
  } else if (!user.googleId) {
    // Link Google account to existing user
    user = await prisma.user.update({
      where: { id: user.id },
      data: { googleId: userInfo.id, authProvider: toPrismaAuthProvider('google') },
    });
  }

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // Generate tokens
  const accessToken = generateAccessToken({
    sub: user.id,
    id: user.id,
    email: user.email,
    role: normalizeUserRole(user.role),
  });

  const rawRefresh = generateRefreshToken();
  const tokenHash = crypto.createHash('sha256').update(rawRefresh).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({ data: { userId: user.id, tokenHash, expiresAt } });

  return {
    tokens: { accessToken, refreshToken: rawRefresh, expiresIn: 900 },
    isNewUser,
  };
}

/**
 * Generate Microsoft OAuth URL
 */
export function getMicrosoftAuthUrl(redirectUri: string, state?: string): string {
  const params = new URLSearchParams({
    client_id: config.MICROSOFT_CLIENT_ID || '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    response_mode: 'query',
    // Carries origin/destination through the OAuth round-trip
    state: state ?? crypto.randomBytes(16).toString('hex'),
  });

  const tenantId = config.MICROSOFT_TENANT_ID || 'common';
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
}

/**
 * Handle Microsoft OAuth callback
 * @param opts.intent 'login' allows linking/logging into an existing account;
 * 'register' refuses emails that already have an account so the caller can
 * show "already registered — please sign in" instead of merging profiles.
 */
export async function handleMicrosoftCallback(
  code: string,
  redirectUri: string,
  opts: { intent?: 'login' | 'register' | null } = {},
): Promise<GoogleCallbackResult> {
  const tenantId = config.MICROSOFT_TENANT_ID || 'common';

  // Exchange code for tokens
  const tokenResponse = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.MICROSOFT_CLIENT_ID || '',
        client_secret: config.MICROSOFT_CLIENT_SECRET || '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    },
  );

  const tokenData = (await tokenResponse.json()) as { access_token?: string };

  if (!tokenResponse.ok) {
    logger.warn({ msg: 'Microsoft token exchange failed', statusCode: tokenResponse.status });
    throw new UnauthorizedError('OAuth authentication failed');
  }

  // Get user info
  const userInfoResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  const userInfo = (await userInfoResponse.json()) as MicrosoftProfile;

  if (!userInfoResponse.ok) {
    logger.warn({ msg: 'Microsoft user info request failed', statusCode: userInfoResponse.status });
    throw new UnauthorizedError('Failed to fetch user information');
  }

  const microsoftEmail = userInfo.mail || userInfo.userPrincipalName;
  if (!microsoftEmail) {
    throw new UnauthorizedError('Microsoft account has no email address');
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: microsoftEmail },
  });

  // A sign-up attempt with an email that already has an account must never
  // create a second account nor silently merge profiles — direct the user to
  // sign in instead.
  if (existingUser && opts.intent === 'register') {
    logger.info({ msg: 'Microsoft sign-up blocked, email already registered', userId: existingUser.id });
    return { status: 'email_exists', email: microsoftEmail };
  }

  let user = existingUser;
  let isNewUser = false;

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: microsoftEmail,
        firstName: userInfo.givenName || '',
        lastName: userInfo.surname || '',
        passwordHash: '',
        role: toPrismaUserRole('user'),
        microsoftId: userInfo.id,
      },
    });
    isNewUser = true;
    logger.info({ msg: 'New OAuth user created', userId: user.id, provider: 'microsoft' });
  } else if (!user.microsoftId) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { microsoftId: userInfo.id },
    });
  }

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // Generate tokens
  const accessToken = generateAccessToken({
    sub: user.id,
    id: user.id,
    email: user.email,
    role: normalizeUserRole(user.role),
  });

  const rawRefresh = generateRefreshToken();
  const tokenHash = crypto.createHash('sha256').update(rawRefresh).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({ data: { userId: user.id, tokenHash, expiresAt } });

  return {
    tokens: { accessToken, refreshToken: rawRefresh, expiresIn: 900 },
    isNewUser,
  };
}

/**
 * Complete onboarding for OAuth users
 */
export async function completeOnboarding(userId: string, accountType: 'user' | 'property_owner') {
  const role = accountType === 'property_owner' ? 'property_owner' : 'user';

  const user = await prisma.user.update({
    where: { id: userId },
    data: { role: toPrismaUserRole(role) },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      createdAt: true,
    },
  });

  logger.info({ msg: 'User completed onboarding', userId, role });
  return { ...user, role: normalizeUserRole(user.role) };
}

/**
 * Update user password
 */
export async function updatePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true }
  });

  if (!user || !user.passwordHash) {
    throw new UnauthorizedError('User not found or no password set');
  }

  // Verify current password
  const isValid = await argon2.verify(user.passwordHash, currentPassword);
  if (!isValid) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  // Hash new password
  const hashedPassword = await argon2.hash(newPassword);

  // Update password and set lastPasswordChange
  await prisma.user.update({
    where: { id: userId },
    data: { 
      passwordHash: hashedPassword,
      lastPasswordChange: new Date()
    }
  });

  logger.info({ msg: 'Password updated', userId });
}

/** Directory avatars are written to, relative to the server's working dir. */
export const AVATAR_DIR = path.join(process.cwd(), 'uploads', 'avatars');

const AVATAR_MIME_EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

/** Remove a previously stored avatar file, ignoring anything not under /uploads. */
async function removeStoredAvatar(avatarPath: string | null): Promise<void> {
  if (!avatarPath || !avatarPath.startsWith('/uploads/')) return;
  try {
    await fs.unlink(path.join(process.cwd(), avatarPath));
  } catch (error) {
    logger.warn({ msg: 'Failed to delete old avatar file', avatarPath });
  }
}

/**
 * Upload user avatar.
 *
 * Files land in <cwd>/uploads/avatars and are served by the static handler on
 * `/uploads`, so the stored path is usable as an <img src> from the frontend.
 */
export async function uploadAvatar(userId: string, req: any): Promise<string> {
  await fs.mkdir(AVATAR_DIR, { recursive: true });

  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
      filename: (_req, file, cb) => {
        const ext =
          AVATAR_MIME_EXTENSIONS[file.mimetype] ||
          path.extname(file.originalname).toLowerCase() ||
          '.jpg';
        cb(null, `${userId}-${Date.now()}${ext}`);
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) {
        cb(new ValidationError('Only image files can be used as an avatar'));
        return;
      }
      cb(null, true);
    },
  });

  return new Promise<string>((resolve, reject) => {
    upload.single('avatar')(req, {} as any, async (err: any) => {
      if (err) {
        if (err instanceof ValidationError) {
          reject(err);
        } else if (err?.code === 'LIMIT_FILE_SIZE') {
          reject(new ValidationError('Avatar images must be 5MB or smaller'));
        } else {
          reject(new ValidationError(err?.message || 'Avatar upload failed'));
        }
        return;
      }

      if (!req.file) {
        reject(new ValidationError('No avatar file was uploaded (expected field "avatar")'));
        return;
      }

      try {
        const previous = await prisma.user.findUnique({
          where: { id: userId },
          select: { profilePicture: true },
        });

        const avatarUrl = `/uploads/avatars/${req.file.filename}`;
        await prisma.user.update({
          where: { id: userId },
          data: { profilePicture: avatarUrl },
        });

        await removeStoredAvatar(previous?.profilePicture ?? null);

        logger.info({ msg: 'Avatar uploaded', userId, avatarUrl });
        resolve(avatarUrl);
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * Delete user avatar
 */
export async function deleteAvatar(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { profilePicture: true }
  });

  if (user?.profilePicture) {
    await removeStoredAvatar(user.profilePicture);
  }

  await prisma.user.update({
    where: { id: userId },
    data: { profilePicture: null }
  });

  logger.info({ msg: 'Avatar deleted', userId });
}

/**
 * Update security settings
 */
export async function updateSecuritySettings(userId: string, settings: SecuritySettings) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!existing) {
    throw new NotFoundError('User');
  }

  const normalized: SecuritySettings = {
    emailNotifications: Boolean(settings.emailNotifications),
    loginAlerts: Boolean(settings.loginAlerts),
    sessionTimeout: Math.min(Math.max(Math.round(settings.sessionTimeout), 5), 120),
  };

  await prisma.user.update({
    where: { id: userId },
    data: { securitySettings: normalized },
  });

  logger.info({ msg: 'Security settings updated', userId });
  return normalized;
}
