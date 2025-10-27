import { Router } from 'express';
import { ping } from '../config/db.js';

const router = Router();

router.get('/', async (req, res) => {
    try {
        await ping();
        res.json({ ok: true, db: 'up' });
    } catch (e) {
        res.status(500).json({ ok: false, db: 'down', error: e.message });
    }
});

export default router;