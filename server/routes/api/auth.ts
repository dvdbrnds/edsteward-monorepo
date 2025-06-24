import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { MultiSamlStrategy } from '@node-saml/passport-saml';
import { TenantService } from '../../middleware/tenant';
import { syslog, LogLevel } from '../../services/syslog';
import { generateServiceProviderMetadata } from '../../config/saml';

const router = Router();

// Add SAML routes for Moravian tenant
router.get('/saml/login/moravian', async (req: Request, res: Response, next: NextFunction) => {
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