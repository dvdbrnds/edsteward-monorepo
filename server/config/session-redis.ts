import session from 'express-session';
import connectRedis from 'connect-redis';
import { createClient } from 'redis';
import { config } from './environment';

// Create Redis client
const redisClient = createClient({
  url: process.env.REDIS_URL,
  socket: {
    connectTimeout: 10000,
    lazyConnect: true,
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
    prefix: 'regulatorytrackr:sess:',
    ttl: 24 * 60 * 60, // 24 hours in seconds
  }),
  secret: config.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true, // Reset expiry on activity
  cookie: {
    secure: config.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    sameSite: 'lax',
  }
};

export { redisClient }; 