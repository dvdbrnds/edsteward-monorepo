import { Router, Request, Response } from 'express';
import { hecvatReport, getComplianceSummary } from '../../data/hecvat-responses';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const router = Router();

const POLICY_DOCUMENTS: Record<string, { file: string; title: string }> = {
  'information-security-policy': {
    file: 'docs/compliance/INFORMATION_SECURITY_POLICY.md',
    title: 'Information Security Policy',
  },
  'incident-response-plan': {
    file: 'docs/compliance/INCIDENT_RESPONSE_PLAN.md',
    title: 'Incident Response Plan',
  },
  'data-retention-policy': {
    file: 'docs/compliance/DATA_RETENTION_POLICY.md',
    title: 'Data Retention Policy',
  },
  'privacy-policy': {
    file: 'docs/compliance/PRIVACY_POLICY.md',
    title: 'Privacy Policy',
  },
  'ai-governance-policy': {
    file: 'docs/compliance/AI_GOVERNANCE_POLICY.md',
    title: 'AI Governance Policy',
  },
  'emergency-access-procedure': {
    file: 'docs/EMERGENCY_ACCESS_PROCEDURE.md',
    title: 'Emergency Access Procedure',
  },
};

/**
 * GET /api/compliance/hecvat
 * Returns the full HECVAT response data
 */
router.get('/hecvat', (req, res) => {
  try {
    res.json({
      success: true,
      report: hecvatReport,
    });
  } catch (error) {
    console.error('Error fetching HECVAT report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch HECVAT report',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/compliance/hecvat/summary
 * Returns a summary of HECVAT compliance status by section
 */
router.get('/hecvat/summary', (req, res) => {
  try {
    const summary = getComplianceSummary();
    res.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error('Error fetching HECVAT summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch HECVAT summary',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/compliance/policies
 * Returns list of available policy documents
 */
router.get('/policies', (_req: Request, res: Response) => {
  const policies = Object.entries(POLICY_DOCUMENTS).map(([slug, doc]) => ({
    slug,
    title: doc.title,
    downloadUrl: `/api/compliance/policies/${slug}/download`,
  }));
  res.json({ success: true, policies });
});

/**
 * GET /api/compliance/policies/:slug/download
 * Downloads a policy document as markdown
 */
router.get('/policies/:slug/download', (req: Request, res: Response) => {
  const { slug } = req.params;
  const doc = POLICY_DOCUMENTS[slug];

  if (!doc) {
    return res.status(404).json({ success: false, error: 'Policy document not found' });
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const appRoot = path.resolve(__dirname, '..', '..', '..');
  const filePath = path.join(appRoot, doc.file);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: 'Policy document file not found' });
  }

  const filename = `EdSteward_${doc.title.replace(/\s+/g, '_')}.md`;
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  fs.createReadStream(filePath).pipe(res);
});

export default router;
