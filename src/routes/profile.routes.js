// src/routes/profile.routes.js
import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { ensureAuth } from '../middlewares/ensureAuth.middleware.js';
import { ProfileController } from '../controllers/profile.controller.js';
import { uploaderFor } from '../config/multer.config.js';

const router = Router();
router.use(ensureAuth);
const uploadAvatar = uploaderFor('avatars'); // guarda en public/images/avatars


router.put('/', requireAuth, ProfileController.updateMe);
router.put('/password', requireAuth, ProfileController.changePassword);
router.post('/avatar', requireAuth, uploadAvatar.single('avatar'), ProfileController.updateAvatar);


export default router;
