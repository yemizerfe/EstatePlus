import request from 'supertest';
import { createApp } from '../../src/app';
import { config } from '../../src/config';

// Integration test — requires running PostgreSQL
// These run against test DB when NODE_ENV=test
jest.mock('../../src/infrastructure/database/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    auditLog: { create: jest.fn() },
  },
  checkDbHealth: jest.fn().mockResolvedValue(true),
  disconnectDb: jest.fn(),
}));

jest.mock('../../src/infrastructure/redis/client', () => ({
  getRedis: jest.fn().mockResolvedValue(null),
  checkRedisHealth: jest.fn().mockResolvedValue(false),
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn(),
}));

jest.mock('../../src/infrastructure/rabbitmq/client', () => ({
  getRabbitChannel: jest.fn().mockResolvedValue(null),
  checkRabbitHealth: jest.fn().mockResolvedValue(false),
  publishJob: jest.fn(),
}));

jest.mock('../../src/infrastructure/kafka/client', () => ({
  getKafkaProducer: jest.fn().mockResolvedValue(null),
  publishEvent: jest.fn(),
  ensureTopics: jest.fn(),
}));

import argon2 from 'argon2';
jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('$argon2id$hashed'),
  verify: jest.fn().mockResolvedValue(true),
  argon2id: 'argon2id',
}));

import { prisma } from '../../src/infrastructure/database/prisma';

const app = createApp();

describe('GET /api/v1/auth/google', () => {
  it('uses the configured Google callback URL', async () => {
    const res = await request(app)
      .get('/api/v1/auth/google')
      .set('Host', 'oauth.example.test');
    const googleUrl = new URL(res.headers.location);

    expect(res.status).toBe(302);
    expect(googleUrl.origin).toBe('https://accounts.google.com');
    expect(googleUrl.searchParams.get('redirect_uri')).toBe(
      config.GOOGLE_CALLBACK_URL ?? `http://oauth.example.test${config.API_PREFIX}/auth/google/callback`,
    );
  });

  it('returns to the originating app page when Google sign-in is cancelled', async () => {
    const startResponse = await request(app)
      .get('/api/v1/auth/google')
      .query({ returnTo: '/login?redirect=%2Fproperties', intent: 'login' });
    const state = new URL(startResponse.headers.location).searchParams.get('state');
    const callbackResponse = await request(app)
      .get('/api/v1/auth/google/callback')
      .query({ error: 'access_denied', state });

    expect(callbackResponse.status).toBe(302);
    expect(callbackResponse.headers.location).toBe(
      `${config.FRONTEND_URL}/login?redirect=%2Fproperties&oauth=cancelled`,
    );
  });
});

describe('POST /api/v1/auth/register', () => {
  it('returns 409 when email is taken', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'x' });
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'taken@example.com', password: 'Password1', firstName: 'A', lastName: 'B' });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('returns 422 for invalid email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', password: 'Password1', firstName: 'A', lastName: 'B' });
    expect(res.status).toBe(422);
  });

  it('registers user successfully', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.create as jest.Mock).mockResolvedValue({
      id: 'new-id',
      email: 'new@example.com',
      firstName: 'New',
      lastName: 'User',
      role: 'user',
      createdAt: new Date(),
    });

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'new@example.com', password: 'Password1a', firstName: 'New', lastName: 'User' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});

describe('POST /api/v1/auth/login', () => {
  it('returns tokens on valid credentials', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'uid', email: 'u@e.com', passwordHash: '$hash', isActive: true, role: 'user',
    });
    (prisma.user.update as jest.Mock).mockResolvedValue({});
    (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});
    (argon2.verify as jest.Mock).mockResolvedValue(true);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'u@e.com', password: 'Password1' });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
  });
});

describe('GET /health', () => {
  it('returns health status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBeLessThan(600);
    expect(res.body.status).toBeDefined();
  });
});
