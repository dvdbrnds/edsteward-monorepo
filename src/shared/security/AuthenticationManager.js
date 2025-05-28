/**
 * Authentication Manager - Phase 4
 * Comprehensive security system with API keys, rate limiting, and validation
 */

import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import { cacheManager } from '../cache/CacheManager.js';
import { logger } from '../../utils/logger.js';

export class AuthenticationManager {
  constructor(config = {}) {
    this.config = {
      apiKeyLength: config.apiKeyLength || 32,
      apiKeyPrefix: config.apiKeyPrefix || 'mcp_',
      defaultRateLimit: config.defaultRateLimit || 100, // requests per hour
      rateLimitWindow: config.rateLimitWindow || 3600, // 1 hour in seconds
      maxApiKeys: config.maxApiKeys || 1000,
      keyExpirationDays: config.keyExpirationDays || 365,
      requireApiKey: config.requireApiKey !== false,
      allowedOrigins: config.allowedOrigins || ['http://localhost:3050'],
      securityHeaders: config.securityHeaders !== false,
      ...config
    };

    this.apiKeys = new Map(); // In production, use database
    this.rateLimitCounters = new Map();
    this.isInitialized = false;

    this.initialize();
  }

  /**
   * Initialize authentication manager
   */
  async initialize() {
    try {
      // Load existing API keys from cache/database
      await this.loadApiKeys();
      
      // Create default admin key if none exist
      if (this.apiKeys.size === 0) {
        const adminKey = await this.createApiKey({
          name: 'Default Admin Key',
          permissions: ['admin', 'read', 'write'],
          rateLimit: 1000
        });
        logger.info('[auth-manager] Created default admin API key:', adminKey.key);
      }

      this.isInitialized = true;
      logger.info('[auth-manager] Authentication manager initialized');

    } catch (error) {
      logger.error('[auth-manager] Failed to initialize:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Create new API key
   */
  async createApiKey(options = {}) {
    try {
      const keyId = crypto.randomUUID();
      const keySecret = crypto.randomBytes(this.config.apiKeyLength).toString('hex');
      const apiKey = `${this.config.apiKeyPrefix}${keySecret}`;

      const keyData = {
        id: keyId,
        key: apiKey,
        name: options.name || `API Key ${Date.now()}`,
        permissions: options.permissions || ['read'],
        rateLimit: options.rateLimit || this.config.defaultRateLimit,
        createdAt: new Date().toISOString(),
        expiresAt: options.expiresAt || this.calculateExpiration(),
        isActive: true,
        lastUsed: null,
        usageCount: 0,
        metadata: options.metadata || {}
      };

      this.apiKeys.set(apiKey, keyData);
      await this.saveApiKey(keyData);

      logger.info('[auth-manager] Created API key:', keyId);
      return keyData;

    } catch (error) {
      logger.error('[auth-manager] Error creating API key:', error);
      throw error;
    }
  }

  /**
   * Validate API key
   */
  async validateApiKey(apiKey) {
    if (!apiKey || !apiKey.startsWith(this.config.apiKeyPrefix)) {
      return { valid: false, reason: 'Invalid API key format' };
    }

    const keyData = this.apiKeys.get(apiKey);
    if (!keyData) {
      return { valid: false, reason: 'API key not found' };
    }

    if (!keyData.isActive) {
      return { valid: false, reason: 'API key is disabled' };
    }

    if (new Date(keyData.expiresAt) < new Date()) {
      return { valid: false, reason: 'API key has expired' };
    }

    // Update usage statistics
    keyData.lastUsed = new Date().toISOString();
    keyData.usageCount++;

    return { 
      valid: true, 
      keyData,
      permissions: keyData.permissions,
      rateLimit: keyData.rateLimit
    };
  }

  /**
   * Check rate limit for API key
   */
  async checkRateLimit(apiKey, endpoint = 'default') {
    try {
      const keyData = this.apiKeys.get(apiKey);
      if (!keyData) {
        return { allowed: false, reason: 'Invalid API key' };
      }

      const rateLimitKey = `rate_limit:${apiKey}:${endpoint}`;
      const windowStart = Math.floor(Date.now() / 1000 / this.config.rateLimitWindow) * this.config.rateLimitWindow;
      const windowKey = `${rateLimitKey}:${windowStart}`;

      // Get current count from cache
      const currentCount = await cacheManager.get(windowKey) || 0;
      const limit = keyData.rateLimit;

      if (currentCount >= limit) {
        return {
          allowed: false,
          reason: 'Rate limit exceeded',
          limit,
          current: currentCount,
          resetTime: (windowStart + this.config.rateLimitWindow) * 1000
        };
      }

      // Increment counter
      await cacheManager.set(windowKey, currentCount + 1, { ttl: this.config.rateLimitWindow });

      return {
        allowed: true,
        limit,
        current: currentCount + 1,
        remaining: limit - currentCount - 1,
        resetTime: (windowStart + this.config.rateLimitWindow) * 1000
      };

    } catch (error) {
      logger.error('[auth-manager] Error checking rate limit:', error);
      return { allowed: true }; // Fail open for availability
    }
  }

  /**
   * Revoke API key
   */
  async revokeApiKey(apiKey) {
    try {
      const keyData = this.apiKeys.get(apiKey);
      if (!keyData) {
        return false;
      }

      keyData.isActive = false;
      keyData.revokedAt = new Date().toISOString();

      await this.saveApiKey(keyData);
      logger.info('[auth-manager] Revoked API key:', keyData.id);
      return true;

    } catch (error) {
      logger.error('[auth-manager] Error revoking API key:', error);
      return false;
    }
  }

  /**
   * List API keys (without secrets)
   */
  listApiKeys() {
    return Array.from(this.apiKeys.values()).map(key => ({
      id: key.id,
      name: key.name,
      permissions: key.permissions,
      rateLimit: key.rateLimit,
      createdAt: key.createdAt,
      expiresAt: key.expiresAt,
      isActive: key.isActive,
      lastUsed: key.lastUsed,
      usageCount: key.usageCount,
      key: key.key.substring(0, 12) + '...' // Masked key
    }));
  }

  /**
   * Get API key statistics
   */
  getApiKeyStats(apiKey) {
    const keyData = this.apiKeys.get(apiKey);
    if (!keyData) {
      return null;
    }

    return {
      id: keyData.id,
      name: keyData.name,
      usageCount: keyData.usageCount,
      lastUsed: keyData.lastUsed,
      createdAt: keyData.createdAt,
      isActive: keyData.isActive
    };
  }

  /**
   * Authentication middleware
   */
  authMiddleware() {
    return async (req, res, next) => {
      try {
        // Skip authentication for health checks and public endpoints
        if (this.isPublicEndpoint(req.path)) {
          return next();
        }

        // Extract API key from header or query
        const apiKey = this.extractApiKey(req);

        if (!apiKey && this.config.requireApiKey) {
          return res.status(401).json({
            error: 'API key required',
            message: 'Please provide a valid API key in the Authorization header or api_key query parameter'
          });
        }

        if (apiKey) {
          // Validate API key
          const validation = await this.validateApiKey(apiKey);
          if (!validation.valid) {
            return res.status(401).json({
              error: 'Invalid API key',
              message: validation.reason
            });
          }

          // Check rate limit
          const rateLimit = await this.checkRateLimit(apiKey, req.path);
          if (!rateLimit.allowed) {
            res.set({
              'X-RateLimit-Limit': rateLimit.limit,
              'X-RateLimit-Remaining': 0,
              'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString()
            });

            return res.status(429).json({
              error: 'Rate limit exceeded',
              message: rateLimit.reason,
              resetTime: rateLimit.resetTime
            });
          }

          // Set rate limit headers
          res.set({
            'X-RateLimit-Limit': rateLimit.limit,
            'X-RateLimit-Remaining': rateLimit.remaining,
            'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString()
          });

          // Attach auth info to request
          req.auth = {
            apiKey,
            keyData: validation.keyData,
            permissions: validation.permissions
          };
        }

        next();

      } catch (error) {
        logger.error('[auth-manager] Authentication middleware error:', error);
        res.status(500).json({
          error: 'Authentication error',
          message: 'Internal server error during authentication'
        });
      }
    };
  }

  /**
   * CORS middleware
   */
  corsMiddleware() {
    return (req, res, next) => {
      const origin = req.headers.origin;
      
      if (this.config.allowedOrigins.includes('*') || this.config.allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin || '*');
      }

      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Max-Age', '86400'); // 24 hours

      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }

      next();
    };
  }

  /**
   * Security headers middleware
   */
  securityHeadersMiddleware() {
    return (req, res, next) => {
      if (this.config.securityHeaders) {
        res.set({
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'X-XSS-Protection': '1; mode=block',
          'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
          'Referrer-Policy': 'strict-origin-when-cross-origin'
        });
      }
      next();
    };
  }

  // Private helper methods

  extractApiKey(req) {
    // Check Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check X-API-Key header
    const apiKeyHeader = req.headers['x-api-key'];
    if (apiKeyHeader) {
      return apiKeyHeader;
    }

    // Check query parameter
    return req.query.api_key;
  }

  isPublicEndpoint(path) {
    const publicPaths = ['/health', '/ping', '/status'];
    return publicPaths.some(publicPath => path.startsWith(publicPath));
  }

  calculateExpiration() {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + this.config.keyExpirationDays);
    return expirationDate.toISOString();
  }

  async loadApiKeys() {
    try {
      const keys = await cacheManager.get('api_keys') || [];
      for (const keyData of keys) {
        this.apiKeys.set(keyData.key, keyData);
      }
      logger.info(`[auth-manager] Loaded ${keys.length} API keys`);
    } catch (error) {
      logger.warn('[auth-manager] Could not load API keys from cache:', error);
    }
  }

  async saveApiKey(keyData) {
    try {
      const allKeys = Array.from(this.apiKeys.values());
      await cacheManager.set('api_keys', allKeys, { ttl: 0 }); // No expiration
    } catch (error) {
      logger.error('[auth-manager] Error saving API key:', error);
    }
  }

  /**
   * Get authentication statistics
   */
  getMetrics() {
    const totalKeys = this.apiKeys.size;
    const activeKeys = Array.from(this.apiKeys.values()).filter(key => key.isActive).length;
    const expiredKeys = Array.from(this.apiKeys.values()).filter(key => 
      new Date(key.expiresAt) < new Date()
    ).length;

    return {
      totalKeys,
      activeKeys,
      expiredKeys,
      revokedKeys: totalKeys - activeKeys - expiredKeys,
      isInitialized: this.isInitialized
    };
  }

  /**
   * Get health status
   */
  async getHealth() {
    return {
      status: this.isInitialized ? 'healthy' : 'unhealthy',
      details: {
        initialized: this.isInitialized,
        metrics: this.getMetrics()
      }
    };
  }
}

// Export singleton instance
export const authManager = new AuthenticationManager();
export default authManager; 