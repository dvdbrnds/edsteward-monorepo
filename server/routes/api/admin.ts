import { Router } from 'express';
import { adminAuthRouter } from './admin-auth.js';

const router = Router();

// Mount admin sub-routes
// Note: admin-dashboard was removed - tenant management belongs in separate admin-console app
router.use('/auth', adminAuthRouter);

export { router as adminRouter };
