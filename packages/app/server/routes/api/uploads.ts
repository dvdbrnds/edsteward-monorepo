import express from 'express';
import multer from 'multer';
import path from 'path';
import { syslog, LogLevel, LogFacility } from '../../services/syslog';
import { uploadLimiter } from '../../middleware/rate-limiter';

const router = express.Router();

// All uploads use memory storage — files are saved to the database
const memoryStorage = multer.memoryStorage();

const upload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Branding assets upload with specific validation
const brandingUpload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for branding assets
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.ico'];
    
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (file.fieldname === 'favicon') {
      // Favicon can be .ico, .png, or .svg
      const faviconTypes = ['image/png', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'];
      const faviconExts = ['.ico', '.png', '.svg'];
      
      if (faviconTypes.includes(file.mimetype) || faviconExts.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error('Favicon must be .ico, .png, or .svg file'));
      }
    } else if (file.fieldname === 'logo') {
      // Logo can be common image formats
      if (allowedTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error('Logo must be .jpg, .jpeg, .png, .gif, or .svg file'));
      }
    } else {
      cb(new Error('Invalid field name'));
    }
  }
});

// Simple auth middleware for uploads
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// Admin auth middleware
const requireAdmin = (req: any, res: express.Response, next: express.NextFunction) => {
  if (!req.isAuthenticated() || !req.user || req.user.role?.toLowerCase() !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Upload branding assets (logo/favicon) — stored in the database
router.post('/branding', requireAdmin, brandingUpload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'favicon', maxCount: 1 }
]), async (req, res) => {
  try {
    const { getDatabaseStorage } = await import('../../services/database');
    const tenantStorage = getDatabaseStorage((req as any).tenantId);

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const results: { [key: string]: string } = {};

    if (files.logo && files.logo[0]) {
      const f = files.logo[0];
      const { url } = await tenantStorage.saveBrandingAsset('logo', f.buffer, f.mimetype, f.originalname);
      results.logoUrl = url;
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Logo saved to DB: ${f.originalname} (${f.size} bytes)`);
    }

    if (files.favicon && files.favicon[0]) {
      const f = files.favicon[0];
      const { url } = await tenantStorage.saveBrandingAsset('favicon', f.buffer, f.mimetype, f.originalname);
      results.faviconUrl = url;
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Favicon saved to DB: ${f.originalname} (${f.size} bytes)`);
    }

    if (Object.keys(results).length === 0) {
      return res.status(400).json({ error: 'No valid files uploaded' });
    }

    res.json({
      success: true,
      message: 'Assets uploaded successfully',
      assets: results
    });
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Branding upload error: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({
      error: 'Upload failed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Regulation file downloads (static assets bundled in the build)
router.get('/regulations/:filename', (req, res) => {
  const fs = require('fs');
  const filename = req.params.filename;
  const isActualProduction = process.env.NODE_ENV === 'production' && process.env.DOCKER_CONTAINER === 'true';
  const basePath = isActualProduction ? '/app' : process.cwd();
  const filePath = path.join(basePath, 'public/downloads/regulations', filename);
  
  if (!fs.existsSync(filePath)) {
    syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, `Regulation file not found: ${filename}`);
    return res.status(404).json({ error: 'Regulation file not found' });
  }
  
  const ext = path.extname(filename).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.txt': 'text/plain',
  };
  if (mimeMap[ext]) res.setHeader('Content-Type', mimeMap[ext]);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  
  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
});

// Export the upload middleware for use in other routes
export { upload, brandingUpload };
export default router; 