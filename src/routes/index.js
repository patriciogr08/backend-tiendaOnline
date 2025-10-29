import { Router } from 'express';
import authRoutes from './auth.routes.js';
import productRoutes from './product.routes.js';
import productTypeRoutes from './productType.routes.js';
import healthRoutes from './health.routes.js';
import setupRoutes from './setup.routes.js';
import cartRoutes from './cart.routes.js';

const api = Router();

api.use('/health', healthRoutes); // GET /api/health
api.use('/setup',  setupRoutes);  // POST /api/setup (si lo necesitas)
api.use('/auth', authRoutes);
api.use('/products', productRoutes);
api.use('/product-types', productTypeRoutes);
api.use('/cart', cartRoutes);  // /api/cart
api.use('/health', healthRoutes);

export default api;