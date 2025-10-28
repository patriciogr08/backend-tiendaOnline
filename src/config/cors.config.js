import cors from 'cors';
import env from './env.js';

export const corsOptions = {
    origin(origin, cb) {
        if (!origin) return cb(null, true); // Postman/curl
        if (env.ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
        cb(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    // Si usas cookies/sesión, pon true y alinea el front (withCredentials)
    credentials: env.CREDENTIALS,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
    preflightContinue: false,
};
