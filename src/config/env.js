// src/config/env.js
import dotenv from 'dotenv';
dotenv.config();

const env = {
    NODE_ENV: process.env.NODE_ENV ?? 'development',
    HOST: process.env.HOST || '0.0.0.0',
    PORT: Number(process.env.PORT || 3000),
    PUBLIC_URL: process.env.PUBLIC_URL, // p.ej. http://localhost:3000
    UPLOAD_DIR: process.env.UPLOAD_DIR || 'public/images/products',
    LOG_LEVEL: process.env.LOG_LEVEL || 'dev',
    CREDENTIALS: (process.env.CREDENTIALS ?? 'false').toLowerCase() === 'true',
    // orígenes permitidos para Ionic/Angular
    ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS ??
        'http://localhost:8100,http://localhost:4200,ionic://localhost,capacitor://localhost'
    ).split(',').map(s => s.trim()),
};

export default env;
