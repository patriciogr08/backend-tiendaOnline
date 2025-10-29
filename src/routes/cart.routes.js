import { Router } from 'express';
import { CartController } from '../controllers/cart.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/roles.middleware.js';
import { ensureAuth } from '../middlewares/ensureAuth.middleware.js';

const router = Router();
router.use(ensureAuth);
// Clientes (y Admin para pruebas)
router.get('/',        requireAuth, requireRole('CLIENTE','ADMIN'), CartController.getOrCreate);
router.post('/items',  requireAuth, requireRole('CLIENTE','ADMIN'), CartController.addItem);
router.put('/items/:itemId', requireAuth, requireRole('CLIENTE','ADMIN'), CartController.updateItem);
router.delete('/items/:itemId', requireAuth, requireRole('CLIENTE','ADMIN'), CartController.removeItem);
router.post('/clear',  requireAuth, requireRole('CLIENTE','ADMIN'), CartController.clear);
router.post('/checkout', requireAuth, requireRole('CLIENTE','ADMIN'), CartController.checkout);

export default router;
