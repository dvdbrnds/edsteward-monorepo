import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { syslog, LogLevel, LogFacility } from '../../services/syslog';

// ES Module compatibility: Get current file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Configure multer storage - use environment-appropriate path
// Check if we're in a real production container or just local production mode
const isActualProduction = process.env.NODE_ENV === 'production' && process.env.DOCKER_CONTAINER === 'true';
const uploadDir = isActualProduction
  ? path.join('/app', 'uploads')
  : path.join(process.cwd(), 'uploads');

// Branding assets directory
const brandingAssetsDir = isActualProduction
  ? path.join('/app', 'client/public/assets')
  : path.join(process.cwd(), 'client/public/assets');

// Ensure upload directories exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

if (!fs.existsSync(brandingAssetsDir)) {
  fs.mkdirSync(brandingAssetsDir, { recursive: true });
}

const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// Special storage for branding assets
const brandingStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, brandingAssetsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const fieldName = file.fieldname;
    
    if (fieldName === 'logo') {
      cb(null, `institution-logo${ext}`);
    } else if (fieldName === 'favicon') {
      cb(null, `institution-favicon${ext}`);
    } else {
      cb(null, `${fieldName}-${Date.now()}${ext}`);
    }
  }
});

const upload = multer({
  storage: multerStorage,
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
  storage: brandingStorage,
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

// Upload branding assets (logo/favicon)
router.post('/branding', requireAdmin, brandingUpload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'favicon', maxCount: 1 }
]), (req, res) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const results: { [key: string]: string } = {};
    const timestamp = Date.now(); // Cache-busting timestamp
    
    if (files.logo && files.logo[0]) {
      const logoFile = files.logo[0];
      // Add cache-busting timestamp to URL to force browser refresh
      results.logoUrl = `/assets/${logoFile.filename}?v=${timestamp}`;
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Logo uploaded: ${logoFile.filename}`);
    }
    
    if (files.favicon && files.favicon[0]) {
      const faviconFile = files.favicon[0];
      // Add cache-busting timestamp to URL to force browser refresh
      results.faviconUrl = `/assets/${faviconFile.filename}?v=${timestamp}`;
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Favicon uploaded: ${faviconFile.filename}`);
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

// Custom file download route with proper content-type handling
router.get('/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(uploadDir, filename);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  // Get file extension to determine content-type
  const ext = path.extname(filename).toLowerCase();
  
  // Set appropriate content-type based on file extension
  if (ext === '.pdf') {
    res.setHeader('Content-Type', 'application/pdf');
  } else if (ext === '.doc') {
    res.setHeader('Content-Type', 'application/msword');
  } else if (ext === '.docx') {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  } else if (ext === '.jpg' || ext === '.jpeg') {
    res.setHeader('Content-Type', 'image/jpeg');
  } else if (ext === '.png') {
    res.setHeader('Content-Type', 'image/png');
  }
  
  // Set content disposition header for download
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  
  // Stream file to response
  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
});

// Regulation file downloads with proper content type handling
router.get('/regulations/:filename', (req, res) => {
  const filename = req.params.filename;
  const basePath = isActualProduction ? '/app' : process.cwd();
  const filePath = path.join(basePath, 'public/downloads/regulations', filename);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, `Regulation file not found: ${filename}`);
    return res.status(404).json({ error: 'Regulation file not found' });
  }
  
  // Get file extension to determine content-type
  const ext = path.extname(filename).toLowerCase();
  
  // Set appropriate content-type based on file extension
  if (ext === '.pdf') {
    res.setHeader('Content-Type', 'application/pdf');
  } else if (ext === '.doc') {
    res.setHeader('Content-Type', 'application/msword');
  } else if (ext === '.docx') {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  } else if (ext === '.jpg' || ext === '.jpeg') {
    res.setHeader('Content-Type', 'image/jpeg');
  } else if (ext === '.png') {
    res.setHeader('Content-Type', 'image/png');
  } else if (ext === '.txt') {
    res.setHeader('Content-Type', 'text/plain');
  }
  
  // Set content disposition header for download
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  
  // Stream file to response
  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
});

// Export the upload middleware for use in other routes
export { upload, brandingUpload };
export default router; 