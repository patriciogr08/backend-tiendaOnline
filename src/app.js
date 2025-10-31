// src/app.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';

import env from './config/env.js';
import { corsOptions } from './config/cors.config.js';
import api from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.middleware.js';
import { notFound } from './middlewares/notFound.middleware.js';
import { httpLogger, varyOriginHeader } from './utils/logger.js';
import { MOUNT_PATH } from './config/multer.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
    const app = express();

    // Seguridad básica
    app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

    // CORS + preflight
    app.use(cors(corsOptions));
    app.use(cors(corsOptions));
    app.use(varyOriginHeader);
    app.use(httpLogger);
    app.use(compression());
    app.use(express.json({ limit: '5mb' }));

    // Archivos estáticos (imágenes)
    const uploadDir = path.isAbsolute(process.env.UPLOAD_DIR || '')
                        ? (process.env.UPLOAD_DIR)
                        : path.join(__dirname, '..', process.env.UPLOAD_DIR || 'public/images');

    // Sirve todo lo que esté dentro de UPLOAD_DIR en /images (o lo que definas en MOUNT_PATH)
    app.use(MOUNT_PATH, express.static(uploadDir));

    // Prefijo API
    app.use('/api', api);

    // 404 y errores
    app.use(notFound);
    app.use(errorHandler);

    return app;
}
