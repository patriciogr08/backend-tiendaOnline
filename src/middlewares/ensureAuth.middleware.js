import jwt from 'jsonwebtoken';

/**
 * Middleware: verifica JWT y popula req.user
 * - Espera Authorization: Bearer <token>
 * - El token debe tener al menos: { sub, correo, rol, nombre_completo }
 */
export function ensureAuth(req, res, next) {
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No autorizado: token faltante' });
    }

    const token = auth.slice(7);
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = {
            id: payload.id,     // mapea sub -> id
            correo: payload.correo,
            rol: payload.rol,
            nombre_completo: payload.nombre_completo
        };

        return next();
    } catch (e) {
        return res.status(401).json({ message: 'Token inválido o expirado' });
    }
}