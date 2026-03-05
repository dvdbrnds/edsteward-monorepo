import { db } from '../db';
import { tenants } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { FEATURE_FLAGS, FeatureFlag, TenantFeatureConfig } from '@shared/feature-flags';

/**
 * Feature Flag Service for Multi-Tenant Application
 * 
 * Manages feature flags at the tenant level, allowing per-tenant feature control
 * without code changes or deployments
 */
export class FeatureFlagService {
  private static cache = new Map<string, Record<string, boolean>>();
  private static cacheExpiry = new Map<string, number>();
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Check if a feature is enabled for a specific tenant
   */
  static async isFeatureEnabled(tenantId: string, featureKey: string): Promise<boolean> {
    try {
      // Check if feature exists in our feature flag definitions
      const featureDefinition = FEATURE_FLAGS[featureKey];
      if (!featureDefinition) {
        console.warn(`[FEATURE-FLAGS] Unknown feature flag: ${featureKey}`);
        return false;
      }

      // Get tenant feature configuration
      const tenantFeatures = await this.getTenantFeatures(tenantId);
      
      // Return tenant-specific setting or default value
      return tenantFeatures[featureKey] ?? featureDefinition.defaultValue;
    } catch (error) {
      console.error(`[FEATURE-FLAGS] Error checking feature ${featureKey} for tenant ${tenantId}:`, error);
      // Fallback to default value on error
      const featureDefinition = FEATURE_FLAGS[featureKey];
      return featureDefinition?.defaultValue ?? false;
    }
  }

  /**
   * Get all feature flags for a tenant
   */
  static async getTenantFeatures(tenantId: string): Promise<Record<string, boolean>> {
    try {
      // Check cache first
      const cached = this.getCachedFeatures(tenantId);
      if (cached) {
        return cached;
      }

      // Fetch from database
      const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
      
      if (tenant.length === 0) {
        console.warn(`[FEATURE-FLAGS] Tenant not found: ${tenantId}`);
        return this.getDefaultFeatures();
      }

      const tenantFeatures = tenant[0].settings?.featureFlags || {};
      
      // Cache the result
      this.setCachedFeatures(tenantId, tenantFeatures);
      
      return tenantFeatures;
    } catch (error) {
      console.error(`[FEATURE-FLAGS] Error fetching features for tenant ${tenantId}:`, error);
      return this.getDefaultFeatures();
    }
  }

  /**
   * Update feature flags for a tenant
   */
  static async updateTenantFeatures(
    tenantId: string, 
    features: Record<string, boolean>,
    updatedBy: string
  ): Promise<boolean> {
    try {
      // Validate feature keys
      const invalidFeatures = Object.keys(features).filter(key => !FEATURE_FLAGS[key]);
      if (invalidFeatures.length > 0) {
        console.warn(`[FEATURE-FLAGS] Invalid feature keys: ${invalidFeatures.join(', ')}`);
        // Remove invalid features
        invalidFeatures.forEach(key => delete features[key]);
      }

      // Get current tenant settings
      const currentTenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
      
      if (currentTenant.length === 0) {
        console.error(`[FEATURE-FLAGS] Tenant not found: ${tenantId}`);
        return false;
      }

      const currentSettings = currentTenant[0].settings || {};
      
      // Update feature flags in tenant settings
      const updatedSettings = {
        ...currentSettings,
        featureFlags: {
          ...(currentSettings.featureFlags || {}),
          ...features
        }
      };

      // Update database
      await db.update(tenants)
        .set({
          settings: updatedSettings,
          updatedAt: new Date()
        })
        .where(eq(tenants.id, tenantId));

      // Clear cache for this tenant
      this.clearTenantCache(tenantId);

      return true;
    } catch (error) {
      console.error(`[FEATURE-FLAGS] Error updating features for tenant ${tenantId}:`, error);
      return false;
    }
  }

  /**
   * Get feature flag configuration with metadata
   */
  static async getTenantFeatureConfig(tenantId: string): Promise<TenantFeatureConfig> {
    const features = await this.getTenantFeatures(tenantId);
    
    return {
      tenantId,
      features,
      updatedAt: new Date(),
      updatedBy: 'system'
    };
  }

  /**
   * Get all available feature flags with their definitions
   */
  static getAvailableFeatures(): Record<string, FeatureFlag> {
    return FEATURE_FLAGS;
  }

  /**
   * Get features by category
   */
  static getFeaturesByCategory(category: string): FeatureFlag[] {
    return Object.values(FEATURE_FLAGS).filter(flag => flag.category === category);
  }

  /**
   * Reset tenant features to defaults
   */
  static async resetTenantFeatures(tenantId: string): Promise<boolean> {
    try {
      const currentTenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
      
      if (currentTenant.length === 0) {
        return false;
      }

      const currentSettings = currentTenant[0].settings || {};
      
      // Remove feature flags (will fall back to defaults)
      const updatedSettings = {
        ...currentSettings,
        featureFlags: undefined
      };

      await db.update(tenants)
        .set({
          settings: updatedSettings,
          updatedAt: new Date()
        })
        .where(eq(tenants.id, tenantId));

      // Clear cache
      this.clearTenantCache(tenantId);

      return true;
    } catch (error) {
      console.error(`[FEATURE-FLAGS] Error resetting features for tenant ${tenantId}:`, error);
      return false;
    }
  }

  /**
   * Bulk check multiple features for a tenant
   */
  static async checkMultipleFeatures(
    tenantId: string, 
    featureKeys: string[]
  ): Promise<Record<string, boolean>> {
    const tenantFeatures = await this.getTenantFeatures(tenantId);
    const results: Record<string, boolean> = {};

    for (const featureKey of featureKeys) {
      const featureDefinition = FEATURE_FLAGS[featureKey];
      if (featureDefinition) {
        results[featureKey] = tenantFeatures[featureKey] ?? featureDefinition.defaultValue;
      } else {
        results[featureKey] = false;
      }
    }

    return results;
  }

  // Private helper methods

  private static getCachedFeatures(tenantId: string): Record<string, boolean> | null {
    const cached = this.cache.get(tenantId);
    const expiry = this.cacheExpiry.get(tenantId);
    
    if (cached && expiry && Date.now() < expiry) {
      return cached;
    }
    
    return null;
  }

  private static setCachedFeatures(tenantId: string, features: Record<string, boolean>): void {
    this.cache.set(tenantId, features);
    this.cacheExpiry.set(tenantId, Date.now() + this.CACHE_TTL);
  }

  private static clearTenantCache(tenantId: string): void {
    this.cache.delete(tenantId);
    this.cacheExpiry.delete(tenantId);
  }

  private static getDefaultFeatures(): Record<string, boolean> {
    const defaults: Record<string, boolean> = {};
    Object.entries(FEATURE_FLAGS).forEach(([key, flag]) => {
      defaults[key] = flag.defaultValue;
    });
    return defaults;
  }

  /**
   * Clear all cached feature flags (useful for testing or manual cache invalidation)
   */
  static clearAllCache(): void {
    this.cache.clear();
    this.cacheExpiry.clear();
  }
} 