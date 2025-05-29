import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { sessionConfig } from './config/session';
import { jsonErrorHandler, apiErrorHandler, deserializationErrorHandler } from './middleware/error';
import { loggingMiddleware } from './middleware/logging';
import { sessionCleanupMiddleware } from './middleware/session';
import { securityHeadersMiddleware } from './middleware/security';

export function createApp(): express.Application {
  const app = express();

  // Security headers
  app.use(securityHeadersMiddleware);

  // Always parse JSON before any routes
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // Error handler specifically for JSON parsing errors
  app.use(jsonErrorHandler);

  // Session management
  app.use(session(sessionConfig));

  // Initialize passport after session
  app.use(passport.initialize());
  app.use(passport.session());

  // Session cleanup
  app.use(sessionCleanupMiddleware);

  // Enhanced logging middleware for API requests
  app.use(loggingMiddleware);

  // Error handlers
  app.use(deserializationErrorHandler);
  app.use(apiErrorHandler);

  return app;
} 