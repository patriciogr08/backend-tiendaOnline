import { Router } from 'express';
import { ProductTypeController } from '../controllers/productType.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/roles.middleware.js';

const router = Router();
router.get('/', requireAuth, requireRole(), ProductTypeController.list);

export default router;
