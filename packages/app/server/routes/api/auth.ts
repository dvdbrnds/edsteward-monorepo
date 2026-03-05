import { Router, Request, Response } from 'express';
import passport from 'passport';
import { TenantService } from '../../middleware/tenant';
import { syslog, LogLevel } from '../../services/syslog';
import { generateServiceProviderMetadata } from '../../config/saml';

const router = Router();

// =============================================================================
// STANDARD AUTH ENDPOINTS (what the client expects)
// =============================================================================

// Get current user - alias for /api/user
router.get('/me', (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Include tenant info in user response
  const userWithTenant = {
    ...req.user,
    tenantId: (req as any).tenantId,
    subdomain: (req as any).tenant?.subdomain
  };
  
  res.json(userWithTenant);
});

// Authentication status check
router.get('/status', (req: Request, res: Response) => {
  const isAuthenticated = req.isAuthenticated();
  const tenantReq = req as any;
  
  res.json({
    authenticated: isAuthenticated,
    user: isAuthenticated ? req.user : null,
    tenantId: tenantReq.tenantId || null,
    subdomain: tenantReq.tenant?.subdomain || null,
    timestamp: new Date().toISOString()
  });
});

// Login endpoint - delegates to main login logic
router.post('/login', (req: Request, res: Response) => {
  // This endpoint exists for client compatibility
  // The actual login logic is in setupAuth() at /api/login
  res.status(501).json({ 
    error: 'Use /api/login endpoint directly', 
    redirect: '/api/login' 
  });
});

// Logout endpoint - delegates to main logout logic  
router.post('/logout', (req: Request, res: Response) => {
  // This endpoint exists for client compatibility  
  // The actual logout logic is in setupAuth() at /api/logout
  res.status(501).json({ 
    error: 'Use /api/logout endpoint directly', 
    redirect: '/api/logout' 
  });
});

// =============================================================================
// SAML AUTH ENDPOINTS (Moravian-specific)
// =============================================================================

// Add SAML routes for Moravian tenant
router.get('/saml', async (req: Request, res: Response) => {
  try {
    const tenant = await TenantService.getTenantBySubdomain('moravian');
    if (!tenant || !tenant.samlConfig) {
      return res.status(400).json({ error: 'SAML not configured for Moravian tenant' });
    }

    // Set tenant context for SAML strategy
    (req as any).tenantId = 'moravian';
    if (req.session) {
      req.session.tenantId = 'moravian';
    }
    
    // Redirect to Okta SSO URL
    res.redirect(tenant.samlConfig.ssoUrl);
  } catch (error) {
    console.error('SAML login error:', error);
    res.status(500).json({ error: 'SAML authentication failed' });
  }
});

router.post('/saml/callback', passport.authenticate('tenant-saml', { 
  failureRedirect: '/login?error=saml_failed' 
}), async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const tenantId = req.session?.tenantId || 'moravian';
    
    // Log successful SAML authentication
    await syslog.logAuthEvent(
      LogLevel.INFO,
      `SAML SSO successful for ${user.email}`,
      user.id,
      user.username,
      { tenantId, provider: 'okta' }
    );

    // Redirect to dashboard
    res.redirect(`https://${tenantId}.edsteward.ai/dashboard`);
  } catch (error) {
    console.error('SAML callback error:', error);
    res.redirect('/login?error=saml_callback_failed');
  }
});

router.get('/saml/metadata/moravian', async (req: Request, res: Response) => {
  try {
    const tenant = await TenantService.getTenantBySubdomain('moravian');
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const metadata = generateServiceProviderMetadata();
    res.type('application/xml');
    res.send(metadata);
  } catch (error) {
    console.error('Metadata generation error:', error);
    res.status(500).json({ error: 'Failed to generate metadata' });
  }
});

export default router; 