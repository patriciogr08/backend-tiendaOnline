import { Router } from 'express';
import { OrdersController } from '../controllers/orders.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/roles.middleware.js';
import { ensureAuth } from '../middlewares/ensureAuth.middleware.js';

const router = Router();
router.use(ensureAuth);

router.get('/admin', requireAuth, requireRole('ADMIN'), OrdersController.adminList);
router.get('/list/me', requireAuth, OrdersController.myList);
router.post('/admin/:id/assign', requireAuth, requireRole('ADMIN'), OrdersController.adminAssign);
router.get('/admin/repartidores', requireAuth, requireRole('ADMIN'), OrdersController.adminCouriers);

router.get('/:id', requireAuth, OrdersController.GetById);

export default router;
