/**
 * Enhanced SAML Authentication for Multi-Tenant System
 * 
 * This module provides modern SAML security features available in @node-saml/passport-saml@4.0.4
 * while maintaining full backward compatibility with existing tenants.
 * 
 * Features:
 * - Enhanced security validation
 * - InResponseTo validation for replay attack prevention
 * - Advanced timing controls
 * - Comprehensive security monitoring
 * - Certificate rotation support
 */

import { Request } from 'express';
import { TenantService } from '../middleware/tenant';
import { syslog, LogLevel } from '../services/syslog';

/**
 * Enhanced SAML Security Configuration
 * Available for new tenants or existing tenants that opt-in
 */
export interface EnhancedSamlConfig {
  // Standard SAML configuration
  callbackUrl: string;
  entryPoint: string;
  issuer: string;
  idpCert: string | string[];
  logoutUrl?: string;
  identifierFormat: string;
  
  // Enhanced security features (available in v4.0.4+)
  signatureAlgorithm: 'sha256';
  digestAlgorithm: 'sha256';
  wantAssertionsSigned: boolean;
  wantAuthnResponseSigned: boolean;
  
  // Advanced security validation
  validateInResponseTo?: 'always' | 'ifPresent' | 'never';
  requestIdExpirationPeriodMs?: number;
  acceptedClockSkewMs?: number;
  maxAssertionAgeMs?: number;
  
  // Tenant-specific
  providerName: string;
  additionalParams: { RelayState: string };
}

/**
 * Get enhanced SAML configuration for modern tenants
 * Falls back to standard configuration for legacy tenants
 */
export async function getEnhancedTenantSamlConfig(
  tenantId: string, 
  req: Request
): Promise<EnhancedSamlConfig> {
  const tenant = await TenantService.getTenantById(tenantId);
  
  if (!tenant || !tenant.samlConfig) {
    throw new Error(`SAML configuration not found for tenant: ${tenantId}`);
  }

  const baseUrl = `https://${tenant.subdomain}.${process.env.BASE_DOMAIN || 'edsteward.ai'}`;
  
  // Base configuration (compatible with all tenants)
  const baseConfig: EnhancedSamlConfig = {
    callbackUrl: `${baseUrl}/auth/saml/callback`,
    entryPoint: tenant.samlConfig.ssoUrl,
    issuer: `urn:edsteward:sp:${tenant.id}`,
    idpCert: tenant.samlConfig.certificate,
    logoutUrl: tenant.samlConfig.sloUrl || tenant.samlConfig.ssoUrl,
    identifierFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
    
    // Modern security algorithms (recommended for all tenants)
    signatureAlgorithm: 'sha256',
    digestAlgorithm: 'sha256', 
    wantAssertionsSigned: true,
    wantAuthnResponseSigned: true,
    
    // Tenant-specific metadata
    providerName: `EdSteward - ${tenant.name}`,
    additionalParams: {
      RelayState: tenant.id
    }
  };

  // ✅ ENHANCED SECURITY: Add modern features for new/opted-in tenants
  const isEnhancedSecurityTenant = await isEnhancedSecurityEnabled(tenant);
  
  if (isEnhancedSecurityTenant) {
    // Enhanced security features (available in @node-saml/passport-saml@4.0.4)
    baseConfig.validateInResponseTo = 'ifPresent'; // Backward compatible mode
    baseConfig.requestIdExpirationPeriodMs = 28800000; // 8 hours
    baseConfig.acceptedClockSkewMs = 5000; // 5 seconds tolerance
    baseConfig.maxAssertionAgeMs = 3600000; // 1 hour maximum assertion age
    
    // Support certificate rotation for enhanced tenants (if configured)
    if (Array.isArray(tenant.samlConfig.certificate)) {
      baseConfig.idpCert = tenant.samlConfig.certificate;
    }
  }

  // ✅ COMPREHENSIVE LOGGING: Track security configuration
  await logSamlSecurityConfiguration(tenant, baseConfig, isEnhancedSecurityTenant);
  
  return baseConfig;
}

/**
 * Determine if tenant has enhanced security features enabled
 * New tenants get enhanced security by default
 * Existing tenants can opt-in via configuration
 */
async function isEnhancedSecurityEnabled(tenant: any): Promise<boolean> {
  // Check if tenant explicitly configured enhanced security
  const samlConfig = tenant.samlConfig || {};
  
  // Default to enhanced security for new tenants (created after implementation date)
  const tenantCreationDate = new Date(tenant.createdAt || tenant.created_at);
  const enhancedSecurityLaunchDate = new Date('2025-07-07'); // Today's implementation
  
  // Enhanced security enabled if:
  // 1. Explicitly enabled in configuration
  // 2. Tenant created after enhanced security launch (default for new tenants)
  // 3. NOT explicitly disabled
  return (
    samlConfig.enhancedSecurity === true ||
    (samlConfig.enhancedSecurity !== false && tenantCreationDate >= enhancedSecurityLaunchDate)
  );
}

/**
 * Log SAML security configuration for monitoring and compliance
 */
async function logSamlSecurityConfiguration(
  tenant: any, 
  config: EnhancedSamlConfig, 
  enhancedSecurity: boolean
): Promise<void> {
  const securityMetrics = {
    tenantId: tenant.id,
    tenantName: tenant.name,
    subdomain: tenant.subdomain,
    
    // Security configuration
    signatureAlgorithm: config.signatureAlgorithm,
    digestAlgorithm: config.digestAlgorithm,
    assertionsSigned: config.wantAssertionsSigned,
    responsesSigned: config.wantAuthnResponseSigned,
    
    // Enhanced security features
    enhancedSecurityEnabled: enhancedSecurity,
    inResponseToValidation: config.validateInResponseTo || 'disabled',
    clockSkewTolerance: config.acceptedClockSkewMs || 'default',
    maxAssertionAge: config.maxAssertionAgeMs || 'unlimited',
    requestIdExpiration: config.requestIdExpirationPeriodMs || 'default',
    
    // Certificate information
    certificateCount: Array.isArray(config.idpCert) ? config.idpCert.length : 1,
    certificateRotationSupported: Array.isArray(config.idpCert),
    
    // Timestamp
    timestamp: new Date().toISOString(),
    configurationVersion: '2.0'
  };

  // Log for operations monitoring
  console.log(`[ENHANCED-SAML] Security configuration for tenant ${tenant.name}:`, securityMetrics);

  // Log security event for audit trail
  await syslog.logAuthEvent(
    LogLevel.INFO,
    `SAML security configuration applied for tenant ${tenant.name}`,
    undefined,
    undefined,
    {
      event: 'saml_security_config',
      tenantId: tenant.id,
      enhancedSecurity,
      securityFeatures: {
        inResponseToValidation: !!config.validateInResponseTo,
        certificateRotation: Array.isArray(config.idpCert),
        advancedTiming: !!(config.acceptedClockSkewMs || config.maxAssertionAgeMs)
      }
    }
  );
}

/**
 * Validate enhanced SAML configuration for tenant
 * Ensures security requirements are met
 */
export function validateEnhancedSamlConfig(config: EnhancedSamlConfig): {
  isValid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // Validate security algorithms
  if (config.signatureAlgorithm !== 'sha256') {
    warnings.push('Consider upgrading to SHA256 signature algorithm for enhanced security');
  }
  
  if (config.digestAlgorithm !== 'sha256') {
    warnings.push('Consider upgrading to SHA256 digest algorithm for enhanced security');
  }
  
  // Validate assertion requirements
  if (!config.wantAssertionsSigned && !config.wantAuthnResponseSigned) {
    errors.push('Either assertions or responses must be signed for security');
  }
  
  // Validate timing configurations
  if (config.acceptedClockSkewMs && config.acceptedClockSkewMs > 30000) {
    warnings.push('Clock skew tolerance > 30 seconds may pose security risks');
  }
  
  if (config.maxAssertionAgeMs && config.maxAssertionAgeMs > 7200000) {
    warnings.push('Maximum assertion age > 2 hours may pose security risks');
  }
  
  // Validate certificate configuration
  if (!config.idpCert) {
    errors.push('IdP certificate is required for SAML validation');
  }
  
  return {
    isValid: errors.length === 0,
    warnings,
    errors
  };
}

/**
 * Generate enhanced service provider metadata for tenant
 * Includes modern security features and certificate rotation support
 */
export function generateEnhancedServiceProviderMetadata(
  tenant: any,
  config: EnhancedSamlConfig
): string {
  const baseUrl = `https://${tenant.subdomain}.${process.env.BASE_DOMAIN || 'edsteward.ai'}`;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
                     entityID="${config.issuer}">
  <md:SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol"
                      WantAssertionsSigned="${config.wantAssertionsSigned}"
                      AuthnRequestsSigned="true">
    
    <!-- Enhanced Security Capabilities -->
    <md:Extensions>
      <edsec:EnhancedSecurity xmlns:edsec="urn:edsteward:extensions:security">
        <edsec:Version>2.0</edsec:Version>
        <edsec:Features>
          <edsec:InResponseToValidation>${config.validateInResponseTo || 'supported'}</edsec:InResponseToValidation>
          <edsec:CertificateRotation>${Array.isArray(config.idpCert)}</edsec:CertificateRotation>
          <edsec:AdvancedTiming>true</edsec:AdvancedTiming>
        </edsec:Features>
      </edsec:EnhancedSecurity>
    </md:Extensions>
    
    <!-- Service Endpoints -->
    <md:AssertionConsumerService index="0" isDefault="true"
                                 Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                                 Location="${config.callbackUrl}" />
    
    <md:SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                            Location="${baseUrl}/auth/saml/logout" />
    
    <!-- Tenant Information -->
    <md:OrganizationName xml:lang="en">${tenant.name}</md:OrganizationName>
    <md:OrganizationDisplayName xml:lang="en">${config.providerName}</md:OrganizationDisplayName>
    <md:OrganizationURL xml:lang="en">${baseUrl}</md:OrganizationURL>
    
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;
}

/**
 * Enhanced error handling for SAML authentication
 * Provides detailed security-focused error information
 */
export class EnhancedSamlError extends Error {
  constructor(
    message: string,
    public readonly tenantId: string,
    public readonly securityContext: {
      feature?: string;
      configValidation?: boolean;
      certificateIssue?: boolean;
      timingIssue?: boolean;
    } = {}
  ) {
    super(message);
    this.name = 'EnhancedSamlError';
  }
}

export default {
  getEnhancedTenantSamlConfig,
  validateEnhancedSamlConfig,
  generateEnhancedServiceProviderMetadata,
  EnhancedSamlError
}; 