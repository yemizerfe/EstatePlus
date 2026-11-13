import * as dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  API_PREFIX: z.string().default('/api/v1'),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Database
  DATABASE_URL: z.string().url(),
  DB_POOL_MIN: z.string().default('2').transform(Number),
  DB_POOL_MAX: z.string().default('10').transform(Number),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_TTL: z.string().default('300').transform(Number),

  // RabbitMQ
  RABBITMQ_URL: z.string().default('amqp://guest:guest@localhost:5672'),

  // Kafka
  KAFKA_BROKERS: z.string().default('localhost:9092'),
  KAFKA_CLIENT_ID: z.string().default('realestate-backend'),
  KAFKA_GROUP_ID: z.string().default('realestate-consumers'),

  // OpenAI
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o'),
  OPENAI_MAX_TOKENS: z.string().default('2048').transform(Number),

  // OAuth - Google
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),

  // OAuth - Microsoft
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_TENANT_ID: z.string().default('common'),

  // Frontend URL
  FRONTEND_URL: z.string().default('http://localhost:5173'),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('900000').transform(Number),
  // A single dashboard view fans out into a dozen API calls, so the ceiling has
  // to leave room for normal browsing behind one shared NAT address.
  RATE_LIMIT_MAX: z.string().default('600').transform(Number),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

// Empty values in .env (e.g. `PORT=`) mean "not set". Without this, an empty
// string wins over the schema default and can coerce to 0 or an empty URL.
const rawEnv: NodeJS.ProcessEnv = { ...process.env };
for (const key of Object.keys(rawEnv)) {
  if (rawEnv[key] === '') delete rawEnv[key];
}
// `PORT=0` means "any free port" to Node, which silently breaks clients that
// expect the documented port. Treat it as unset so the default applies.
if (rawEnv.PORT === '0') delete rawEnv.PORT;

const parsed = envSchema.safeParse(rawEnv);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;
