import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import {
  listProducts, getProduct, createProduct, updateProduct, deleteProduct
} from '../controllers/products.controller.js';

const router = Router();

// Público (por defecto published=1)
router.get('/', listProducts);
router.get('/:id', getProduct);

// Admin
router.post('/', auth(true), requireRole('ADMIN'), createProduct);
router.put('/:id', auth(true), requireRole('ADMIN'), updateProduct);
router.delete('/:id', auth(true), requireRole('ADMIN'), deleteProduct);

export default router;
