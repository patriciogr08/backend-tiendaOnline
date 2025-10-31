import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/roles.middleware.js';
import { ensureAuth } from '../middlewares/ensureAuth.middleware.js';
import { uploaderFor } from '../config/multer.config.js';
import { CourierController } from '../controllers/courier.controller.js';

const router = Router();
router.use(ensureAuth);
const uploadReceipt = uploaderFor('comprobante'); 

router.get('/pedidos', requireAuth, requireRole('REPARTIDOR'), CourierController.list);
router.post('/pedidos/:id/start', requireAuth, requireRole('REPARTIDOR'), CourierController.startDelivery);
router.post(
    '/pedidos/:id/complete',
    requireAuth,
    requireRole('REPARTIDOR'),
    uploadReceipt.single('comprobante'),
    CourierController.completeWithPayment
);

export default router;
