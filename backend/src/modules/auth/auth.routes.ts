import { Router, Request, Response } from 'express';
import { body } from 'express-validator';

import { config } from '../../config';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { AuthenticatedRequest } from '../../shared/types';
import { logger } from '../../shared/utils/logger';
import { sendSuccess, sendCreated } from '../../shared/utils/response';
import * as authService from './auth.service';
import { setAuthCookies, clearAuthCookies } from './auth.service';

const router = Router();

/** Append a query param to an app path without clobbering existing ones. */
function appendQueryParam(path: string, param: string): string {
  return path.includes('?') ? `${path}&${param}` : `${path}?${param}`;
}

/** Absolute frontend URL for a sanitized, app-relative path. */
function frontendPath(path: string): string {
  return `${config.FRONTEND_URL}${path}`;
}

/** Use the same canonical callback URL when starting and completing OAuth. */
function googleCallbackUrl(req: Request): string {
  return config.GOOGLE_CALLBACK_URL
    ?? `${req.protocol}://${req.get('host')}${config.API_PREFIX}/auth/google/callback`;
}

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 */
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password')
      .isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/),
    body('firstName').trim().isLength({ min: 1, max: 100 }),
    body('lastName').trim().isLength({ min: 1, max: 100 }),
    body('accountType').optional().isIn(['user', 'property_owner']),
    validate,
  ],
  async (req: Request, res: Response) => {
    const user = await authService.register(req.body as authService.RegisterDto);
    sendCreated(res, user, 'Registration successful');
  },
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login and receive tokens
 */
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
    validate,
  ],
  async (req: Request, res: Response) => {
    const tokens = await authService.login(req.body as authService.LoginDto);
    setAuthCookies(res, tokens);
    sendSuccess(res, tokens, 200, 'Login successful');
  },
);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request password reset
 */
router.post(
  '/forgot-password',
  [
    body('email').isEmail().normalizeEmail(),
    validate,
  ],
  async (req: Request, res: Response) => {
    await authService.forgotPassword(req.body as authService.ForgotPasswordDto);
    sendSuccess(res, null, 200, 'If your email is registered, you will receive password reset instructions.');
  },
);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token
 */
router.post(
  '/refresh',
  async (req: Request, res: Response) => {
    // Read refresh token from HTTP-only cookie
    const refreshToken = (req as Request & { cookies?: Record<string, string> }).cookies?.refresh_token;
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'No refresh token provided' });
    }
    const tokens = await authService.refreshTokens(refreshToken);
    setAuthCookies(res, tokens);
    return sendSuccess(res, tokens);
  },
);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout and invalidate refresh token
 */
router.post(
  '/logout',
  async (req: Request, res: Response) => {
    // Read refresh token from HTTP-only cookie
    const refreshToken = (req as Request & { cookies?: Record<string, string> }).cookies?.refresh_token;
    if (refreshToken) {
      await authService.logout(refreshToken);
    }
    clearAuthCookies(res);
    sendSuccess(res, null, 200, 'Logged out successfully');
  },
);

/**
 * @swagger
 * /auth/profile:
 *   get:
 *     tags: [Auth]
 *     summary: Get current user profile
 *     security: [{ bearerAuth: [] }]
 */
router.get('/profile', authenticate, async (req: Request, res: Response) => {
  const profile = await authService.getProfile((req as AuthenticatedRequest).user.sub);
  sendSuccess(res, profile);
});

/**
 * @swagger
 * /auth/password:
 *   put:
 *     tags: [Auth]
 *     summary: Update user password
 *     security: [{ bearerAuth: [] }]
 */
router.put(
  '/password',
  [
    authenticate,
    body('currentPassword').notEmpty(),
    body('newPassword')
      .isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/),
    validate,
  ],
  async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).user.sub;
    await authService.updatePassword(userId, req.body.currentPassword, req.body.newPassword);
    sendSuccess(res, null, 200, 'Password updated successfully');
  },
);

/**
 * @swagger
 * /auth/avatar:
 *   post:
 *     tags: [Auth]
 *     summary: Upload user avatar
 *     security: [{ bearerAuth: [] }]
 */
router.post('/avatar', authenticate, async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).user.sub;
  const avatarUrl = await authService.uploadAvatar(userId, req);
  sendSuccess(res, { avatarUrl }, 200, 'Avatar uploaded successfully');
});

/**
 * @swagger
 * /auth/avatar:
 *   delete:
 *     tags: [Auth]
 *     summary: Delete user avatar
 *     security: [{ bearerAuth: [] }]
 */
router.delete('/avatar', authenticate, async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).user.sub;
  await authService.deleteAvatar(userId);
  sendSuccess(res, null, 200, 'Avatar deleted successfully');
});

/**
 * @swagger
 * /auth/security-settings:
 *   put:
 *     tags: [Auth]
 *     summary: Update security settings
 *     security: [{ bearerAuth: [] }]
 */
router.put(
  '/security-settings',
  [
    authenticate,
    body('emailNotifications').isBoolean(),
    body('loginAlerts').isBoolean(),
    body('sessionTimeout').isInt({ min: 5, max: 120 }),
    validate,
  ],
  async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).user.sub;
    const settings = await authService.updateSecuritySettings(userId, req.body);
    sendSuccess(res, settings, 200, 'Security settings updated successfully');
  },
);

/**
 * @swagger
 * /auth/verify-email:
 *   post:
 *     tags: [Auth]
 *     summary: Check if email exists and is valid
 */
router.post(
  '/verify-email',
  [body('email').isEmail().normalizeEmail(), validate],
  async (req: Request, res: Response) => {
    const result = await authService.verifyEmailExists(req.body.email);
    sendSuccess(res, result);
  },
);

/**
 * OAuth Routes
 */

/**
 * @swagger
 * /auth/google:
 *   get:
 *     tags: [Auth]
 *     summary: Initiate Google OAuth flow
 */
router.get('/google', (req: Request, res: Response) => {
  const redirectUri = googleCallbackUrl(req);
  // Carry the user's origin (returnTo) and destination (redirect) through the
  // OAuth round-trip so Cancel/Continue behave like the rest of the app.
  const googleAuthUrl = authService.getGoogleAuthUrl(
    redirectUri,
    authService.buildOAuthState(req.query.redirect, req.query.returnTo, req.query.intent),
  );
  res.redirect(googleAuthUrl);
});

/**
 * @swagger
 * /auth/google/callback:
 *   get:
 *     tags: [Auth]
 *     summary: Google OAuth callback
 */
router.get('/google/callback', async (req: Request, res: Response) => {
  // Destinations embedded in the `state` param by /auth/google.
  const { redirectTo, backTo, intent, valid } = authService.readOAuthState(req.query.state);
  if (!valid) {
    return res.redirect(frontendPath('/login?error=oauth_failed'));
  }
  // Where the user was when they clicked "Continue with Google".
  const originPage = backTo ?? '/login';

  try {
    const { code } = req.query;

    // User clicked "Cancel" on the Google consent screen — silently take them
    // back to where they started instead of showing a dead end.
    if (!code && req.query.error === 'access_denied') {
      logger.info({ msg: 'Google OAuth cancelled by user' });
      return res.redirect(frontendPath(appendQueryParam(originPage, 'oauth=cancelled')));
    }

    if (!code || typeof code !== 'string') {
      return res.redirect(frontendPath(appendQueryParam(originPage, 'error=oauth_failed')));
    }

    const redirectUri = googleCallbackUrl(req);
    const result = await authService.handleGoogleCallback(code, redirectUri, { intent });

    // Google login/sign-up status checks must keep users on the proper auth flow.
    if ('status' in result) {
      if (result.status === 'email_exists') {
        logger.info({ msg: 'Google sign-up rejected, email already registered' });
        const params = new URLSearchParams({ oauth: 'email_exists' });
        if (redirectTo) params.set('redirect', redirectTo);
        return res.redirect(`${config.FRONTEND_URL}/login?${params.toString()}`);
      }

      if (result.status === 'user_not_found') {
        logger.info({ msg: 'Google login rejected for unregistered user' });
        const params = new URLSearchParams({ oauth: 'signup_required' });
        if (redirectTo) params.set('redirect', redirectTo);
        return res.redirect(`${config.FRONTEND_URL}/register?${params.toString()}`);
      }
    }

    // Set HTTP-only cookies for tokens
    setAuthCookies(res, result.tokens);

    if (result.isNewUser) {
      // New user needs onboarding
      res.redirect(`${config.FRONTEND_URL}/onboarding`);
    } else {
      // Existing user — continue to where they were originally headed.
      res.redirect(frontendPath(redirectTo ?? '/app'));
    }
  } catch (error) {
    logger.error({
      msg: 'Google OAuth callback failed',
      errorType: error instanceof Error ? error.name : 'UnknownError',
    });
    res.redirect(frontendPath(appendQueryParam(originPage, 'error=oauth_failed')));
  }
});

/**
 * @swagger
 * /auth/microsoft:
 *   get:
 *     tags: [Auth]
 *     summary: Initiate Microsoft OAuth flow
 */
router.get('/microsoft', (req: Request, res: Response) => {
  const redirectUri = `${req.protocol}://${req.get('host')}/api/v1/auth/microsoft/callback`;
  // Carry the user's origin (returnTo) and destination (redirect) through the
  // OAuth round-trip so Cancel/Continue behave like the rest of the app.
  const microsoftAuthUrl = authService.getMicrosoftAuthUrl(
    redirectUri,
    authService.buildOAuthState(req.query.redirect, req.query.returnTo, req.query.intent),
  );
  res.redirect(microsoftAuthUrl);
});

/**
 * @swagger
 * /auth/microsoft/callback:
 *   get:
 *     tags: [Auth]
 *     summary: Microsoft OAuth callback
 */
router.get('/microsoft/callback', async (req: Request, res: Response) => {
  // Destinations embedded in the `state` param by /auth/microsoft.
  const { redirectTo, backTo, intent, valid } = authService.readOAuthState(req.query.state);
  if (!valid) {
    return res.redirect(frontendPath('/login?error=oauth_failed'));
  }
  const originPage = backTo ?? '/login';

  try {
    const { code } = req.query;

    // User clicked "Cancel" on the Microsoft consent screen — silently take
    // them back to where they started instead of showing a dead end.
    if (!code && req.query.error === 'access_denied') {
      logger.info({ msg: 'Microsoft OAuth cancelled by user' });
      return res.redirect(frontendPath(appendQueryParam(originPage, 'oauth=cancelled')));
    }

    if (!code || typeof code !== 'string') {
      return res.redirect(frontendPath(appendQueryParam(originPage, 'error=oauth_failed')));
    }

    const redirectUri = `${req.protocol}://${req.get('host')}/api/v1/auth/microsoft/callback`;
    const result = await authService.handleMicrosoftCallback(code, redirectUri, { intent });

    // Sign-up attempted with an email that already has an account — never log
    // them in; send them to sign in instead, preserving their destination.
    if ('status' in result) {
      logger.info({ msg: 'Microsoft sign-up rejected, email already registered' });
      const params = new URLSearchParams({ oauth: 'email_exists' });
      if (redirectTo) params.set('redirect', redirectTo);
      return res.redirect(`${config.FRONTEND_URL}/login?${params.toString()}`);
    }

    // Set HTTP-only cookies for tokens
    setAuthCookies(res, result.tokens);

    if (result.isNewUser) {
      res.redirect(`${config.FRONTEND_URL}/onboarding`);
    } else {
      // Existing user — continue to where they were originally headed.
      res.redirect(frontendPath(redirectTo ?? '/app'));
    }
  } catch (error) {
    logger.error({
      msg: 'Microsoft OAuth callback failed',
      errorType: error instanceof Error ? error.name : 'UnknownError',
    });
    res.redirect(frontendPath(appendQueryParam(originPage, 'error=oauth_failed')));
  }
});

/**
 * @swagger
 * /auth/onboarding:
 *   post:
 *     tags: [Auth]
 *     summary: Complete OAuth user onboarding
 */
router.post(
  '/onboarding',
  [
    authenticate,
    body('accountType').isIn(['user', 'property_owner']),
    validate,
  ],
  async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).user.sub;
    const user = await authService.completeOnboarding(userId, req.body.accountType);
    sendSuccess(res, user, 200, 'Onboarding completed');
  },
);

export default router;
