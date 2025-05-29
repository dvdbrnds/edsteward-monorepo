import session from 'express-session';
import { config, isProduction } from './environment';
import { storage } from '../storage';

export const sessionConfig: session.SessionOptions = {
  store: storage.sessionStore,
  secret: config.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}; 