import { type Express } from "express";

export function registerDebugRoutes(app: Express) {
  app.get("/api/debug/hostname", (req, res) => {
    const hostname = req.get('host') || '';
    const userAgent = req.get('user-agent') || '';
    const timestamp = new Date().toISOString();
    
    res.json({
      timestamp,
      hostname,
      userAgent,
      headers: {
        host: req.get('host'),
        'x-forwarded-host': req.get('x-forwarded-host'),
        'x-forwarded-proto': req.get('x-forwarded-proto'),
      },
      deployment: "server-side-title-injection-v2",
      titleLogic: {
        isAdmin: hostname.startsWith('admin.'),
        isMoravian: hostname.startsWith('moravian.'),
        expectedTitle: hostname.startsWith('admin.') ? 'EdSteward Admin Console' : 
                      hostname.startsWith('moravian.') ? 'Moravian University Compliance Portal' : 
                      'EdSteward Admin Console'
      }
    });
  });
} 