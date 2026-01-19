import { Router } from 'express';
import jwt from 'jsonwebtoken';

const router = Router();

// Mock admin users for development - replace with real database
const adminUsers = [
  {
    id: 'admin-1',
    email: 'admin@edsteward.ai',
    password: 'admin123', // Simple password for development
    name: 'Admin User',
    role: 'super_admin' as const,
    permissions: ['*'],
    createdAt: new Date(),
  },
  {
    id: 'admin-2', 
    email: 'dvdbrnds@gmail.com',
    password: 'admin123', // Simple password for development
    name: 'David Brandes',
    role: 'super_admin' as const,
    permissions: ['*'],
    createdAt: new Date(),
  }
];

// POST /admin/api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find admin user
    const adminUser = adminUsers.find(user => user.email === email);
    if (!adminUser) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Verify password (simple comparison for development)
    if (password !== adminUser.password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: adminUser.id, 
        email: adminUser.email, 
        role: adminUser.role 
      },
      process.env.ADMIN_JWT_SECRET || 'admin-secret-key',
      { expiresIn: '24h' }
    );

    // Return user data (without password) and token
    const { password: _, ...userWithoutPassword } = adminUser;
    res.json({
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /admin/api/auth/me
router.get('/me', authenticateAdminToken, (req, res) => {
  // Return current admin user
  const adminUser = adminUsers.find(user => user.id === req.adminUser.id);
  if (!adminUser) {
    return res.status(404).json({ message: 'Admin user not found' });
  }

  const { password: _, ...userWithoutPassword } = adminUser;
  res.json(userWithoutPassword);
});

// Middleware to authenticate admin JWT token
function authenticateAdminToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET || 'admin-secret-key') as any;
    req.adminUser = decoded;
    next();
  } catch {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
}

export { router as adminAuthRouter, authenticateAdminToken }; 