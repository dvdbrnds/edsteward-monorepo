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

// Configure multer storage
const uploadDir = path.join(process.cwd(), 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
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
  const filePath = path.join(process.cwd(), 'public/downloads/regulations', filename);
  
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
export { upload };
export default router; 