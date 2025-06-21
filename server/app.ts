import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { sessionConfig } from './config/session';
import { jsonErrorHandler, apiErrorHandler, deserializationErrorHandler } from './middleware/error';
import { loggingMiddleware } from './middleware/logging';
import { sessionCleanupMiddleware, sessionDebugMiddleware } from './middleware/session';
import { securityHeadersMiddleware } from './middleware/security';

export function createApp(): express.Application {
  const app = express();

  // CRITICAL AWS ALB FIX: Trust first proxy (ALB) for X-Forwarded-* headers
  // This enables secure cookies by reading X-Forwarded-Proto header
  app.set('trust proxy', 1);

  // Security headers
  app.use(securityHeadersMiddleware);

  // Always parse JSON before any routes
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // Error handler specifically for JSON parsing errors
  app.use(jsonErrorHandler);

  // Session management with AWS ALB trust proxy configuration
  app.use(session(sessionConfig));

  // Initialize passport after session
  app.use(passport.initialize());
  app.use(passport.session());

  // Session cleanup and debugging
  app.use(sessionCleanupMiddleware);
  app.use(sessionDebugMiddleware);

  // Enhanced logging middleware for API requests
  app.use(loggingMiddleware);

  // Error handlers
  app.use(deserializationErrorHandler);
  app.use(apiErrorHandler);

  return app;
} 