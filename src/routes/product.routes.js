import { Router } from 'express';
import { ProductController } from '../controllers/products.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/roles.middleware.js';
import { uploaderFor } from '../config/multer.config.js';

const router = Router();
export const upload = uploaderFor('products');

// Metadata para el formulario (cualquier autenticado)
router.get('/meta', requireAuth, requireRole(), ProductController.meta);

// List/Get (cualquier autenticado)
router.get('/',    requireAuth, requireRole(), ProductController.list);
// Crear/Actualizar/Eliminar (solo ADMIN)
router.post('/',      requireAuth, requireRole('ADMIN'), upload.single('foto'), ProductController.create);
router.put('/:id',    requireAuth, requireRole('ADMIN'), upload.single('foto'), ProductController.update);
router.delete('/:id', requireAuth, requireRole('ADMIN'), ProductController.remove);

export default router;
