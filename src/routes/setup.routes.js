import { Router } from 'express';
import { setupAdmin } from '../controllers/setup.controller.js';
import dotenv from 'dotenv';
dotenv.config();

const router = Router();

router.post('/admin', async (req, res, next) => {
    if (process.env.SETUP_ENABLED !== 'true') {
        return res.status(403).json({ message: 'Setup deshabilitado' });
    }
    next();
    }, setupAdmin);

export default router;
