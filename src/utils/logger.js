import morgan from 'morgan';
import env from '../config/env.js';

export const httpLogger = morgan(env.LOG_LEVEL);

export function varyOriginHeader(_req, res, next) {
    res.setHeader('Vary', 'Origin');
    next();
}