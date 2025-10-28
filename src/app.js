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
// import { requestId } from './middlewares/requestId.js';

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

    // Identificador de request (opcional)
    // app.use(requestId);

    // Logs + performance
    app.use(httpLogger);
    app.use(compression());
    app.use(express.json({ limit: '5mb' }));

    // Archivos estáticos (imágenes)
    const uploadDir = path.isAbsolute(env.UPLOAD_DIR)
        ? env.UPLOAD_DIR
        : path.join(__dirname, '..', env.UPLOAD_DIR);

    app.use('/images', express.static(uploadDir));

    // Prefijo API
    app.use('/api', api);

    // 404 y errores
    app.use(notFound);
    app.use(errorHandler);

    return app;
}
