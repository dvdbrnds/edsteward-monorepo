import { Router } from 'express';
import { adminAuthRouter } from './admin-auth.js';
import { adminDashboardRouter } from './admin-dashboard.js';

const router = Router();

// Mount admin sub-routes
router.use('/auth', adminAuthRouter);
router.use('/dashboard', adminDashboardRouter);

export { router as adminRouter }; 