// src/routes/addresses.routes.js
import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { AddressesController } from '../controllers/addresses.controller.js';
import { ensureAuth } from '../middlewares/ensureAuth.middleware.js';

const router = Router();
router.use(ensureAuth);

router.get('/addresses', requireAuth, AddressesController.list);
router.post('/addresses', requireAuth, AddressesController.create);
router.put('/addresses/:id', requireAuth, AddressesController.update);
router.put('/addresses/:id/default', requireAuth, AddressesController.setDefault);
router.delete('/addresses/:id', requireAuth, AddressesController.remove);

export default router;
