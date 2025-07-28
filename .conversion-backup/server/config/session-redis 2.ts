import session from 'express-session';
import connectRedis from 'connect-redis';
import { createClient } from 'redis';
import { config, isProduction } from './environment';

// CRITICAL AWS ALB FIX - Enable debugging for Redis session config too
console.log('🔍 Redis Session Store Debug - AWS ALB Configuration');
console.log('🔍 Environment:', isProduction ? 'PRODUCTION' : 'DEVELOPMENT');
console.log('🔍 Trust Proxy: Enabled for AWS ALB');

// Create Redis client
const redisClient = createClient({
  url: process.env.REDIS_URL,
  socket: {
    connectTimeout: 10000,
  },
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  console.log('Redis Client Connected');
});

// Initialize Redis connection
redisClient.connect().catch(console.error);

// Create Redis store
const RedisStore = connectRedis(session);

export const redisSessionConfig: session.SessionOptions = {
  store: new RedisStore({
    client: redisClient,
    prefix: 'edsteward:sess:',
    ttl: 24 * 60 * 60, // 24 hours in seconds
  }),
  secret: config.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true, // Reset expiry on activity
  cookie: {
    // CRITICAL AWS ALB FIX: Use secure: 'auto' instead of boolean
    // This automatically enables secure cookies when X-Forwarded-Proto is https
    secure: 'auto', // AUTO-DETECTS HTTPS from ALB proxy headers
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    sameSite: 'lax',
  }
};

export { redisClient }; 