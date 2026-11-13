// Unit tests for auth service — mocking Prisma and argon2
import { ConflictError, UnauthorizedError } from '../../src/shared/utils/errors';

// Mock prisma
jest.mock('../../src/infrastructure/database/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

// Mock argon2
jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('$argon2id$hashed'),
  verify: jest.fn(),
  argon2id: 'argon2id',
}));

import argon2 from 'argon2';
import { prisma } from '../../src/infrastructure/database/prisma';
import {
  buildOAuthState,
  login,
  readOAuthState,
  register,
} from '../../src/modules/auth/auth.service';

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  passwordHash: '$argon2id$hashed',
  firstName: 'Test',
  lastName: 'User',
  role: 'user' as const,
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('Auth Service', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('OAuth state', () => {
    it('round-trips safe destinations and intent', () => {
      const state = buildOAuthState('/properties?type=apartment', '/login', 'login');

      expect(readOAuthState(state)).toMatchObject({
        redirectTo: '/properties?type=apartment',
        backTo: '/login',
        intent: 'login',
        valid: true,
      });
    });

    it('rejects altered state data', () => {
      const state = buildOAuthState('/app', '/login', 'login');
      const [encodedPayload, signature] = state.split('.');
      const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
      payload.r = '/attacker.example';
      const alteredState = `${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${signature}`;

      expect(readOAuthState(alteredState).valid).toBe(false);
    });
  });

  describe('register', () => {
    it('throws ConflictError when email already exists', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      await expect(
        register({ email: 'test@example.com', password: 'Password1', firstName: 'A', lastName: 'B' })
      ).rejects.toThrow(ConflictError);
    });

    it('creates user with hashed password', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      const result = await register({
        email: 'new@example.com',
        password: 'Password1',
        firstName: 'Test',
        lastName: 'User',
      });

      expect(argon2.hash).toHaveBeenCalledWith('Password1', expect.any(Object));
      expect(result.email).toBe('test@example.com');
    });
  });

  describe('login', () => {
    it('throws UnauthorizedError for unknown email', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        login({ email: 'unknown@example.com', password: 'Password1' })
      ).rejects.toThrow(UnauthorizedError);
    });

    it('throws UnauthorizedError for wrong password', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(
        login({ email: 'test@example.com', password: 'WrongPassword' })
      ).rejects.toThrow(UnauthorizedError);
    });

    it('returns tokens on successful login', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});

      const tokens = await login({ email: 'test@example.com', password: 'Password1' });
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.expiresIn).toBe(900);
    });
  });
});
