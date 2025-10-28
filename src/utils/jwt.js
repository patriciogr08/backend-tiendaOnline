import 'dotenv/config';
import jwt from 'jsonwebtoken';

export function signAccessToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '2h'
    });
}

export function verifyAccessToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
}