/**
 * Rate Limiting Middleware
 * Protects API endpoints from abuse and DDoS attacks
 */

import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// Standard API rate limiter - 100 requests per 15 minutes per IP
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests',
    message: 'You have exceeded the rate limit. Please try again later.',
    retryAfter: 15 * 60, // seconds
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'You have exceeded the rate limit. Please try again later.',
      retryAfter: Math.ceil((req.rateLimit?.resetTime?.getTime() || Date.now() + 15 * 60 * 1000 - Date.now()) / 1000),
    });
  },
});

// Strict rate limiter for authentication endpoints - 5 attempts per 15 minutes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: {
    error: 'Too many login attempts',
    message: 'Too many login attempts. Please try again in 15 minutes.',
    retryAfter: 15 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many login attempts',
      message: 'Too many login attempts. Please try again in 15 minutes.',
      retryAfter: Math.ceil((req.rateLimit?.resetTime?.getTime() || Date.now() + 15 * 60 * 1000 - Date.now()) / 1000),
    });
  },
});

// Password reset rate limiter - 3 requests per hour
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset requests per hour
  message: {
    error: 'Too many password reset requests',
    message: 'Too many password reset requests. Please try again in an hour.',
    retryAfter: 60 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many password reset requests',
      message: 'Too many password reset requests. Please try again in an hour.',
      retryAfter: Math.ceil((req.rateLimit?.resetTime?.getTime() || Date.now() + 60 * 60 * 1000 - Date.now()) / 1000),
    });
  },
});

// File upload rate limiter - 20 uploads per hour
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 uploads per hour
  message: {
    error: 'Too many uploads',
    message: 'Upload limit exceeded. Please try again later.',
    retryAfter: 60 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many uploads',
      message: 'Upload limit exceeded. Please try again later.',
      retryAfter: Math.ceil((req.rateLimit?.resetTime?.getTime() || Date.now() + 60 * 60 * 1000 - Date.now()) / 1000),
    });
  },
});

// Admin operations rate limiter - 50 requests per 15 minutes  
export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit admin operations
  message: {
    error: 'Too many admin requests',
    message: 'Admin rate limit exceeded. Please slow down.',
    retryAfter: 15 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many admin requests',
      message: 'Admin rate limit exceeded. Please slow down.',
      retryAfter: Math.ceil((req.rateLimit?.resetTime?.getTime() || Date.now() + 15 * 60 * 1000 - Date.now()) / 1000),
    });
  },
});

// Burst limiter for expensive operations - 10 requests per minute
export const burstLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit expensive operations
  message: {
    error: 'Too many requests',
    message: 'Please slow down and try again in a minute.',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'Please slow down and try again in a minute.',
      retryAfter: Math.ceil((req.rateLimit?.resetTime?.getTime() || Date.now() + 60 * 1000 - Date.now()) / 1000),
    });
  },
});

