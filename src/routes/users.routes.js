// src/routes/admin.users.routes.js
import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/roles.middleware.js';
import { UsersController } from '../controllers/users.controller.js';

const router = Router();

router.get('/users', requireAuth, requireRole('ADMIN'), UsersController.list);
router.post('/users', requireAuth, requireRole('ADMIN'), UsersController.createRepartidor);
router.put('/users/:id/status', requireAuth, requireRole('ADMIN'), UsersController.setStatus);
router.put('/users/:id', requireAuth, requireRole('ADMIN'), UsersController.updateBasic);


export default router;
