import jwt from 'jsonwebtoken';

/**
 * Middleware de autenticación JWT
 * Si `required` es true (por defecto), exige token válido
 */
export function auth(required = true) {
    return (req, res, next) => {
        const header = req.headers.authorization || '';
        const token = header.startsWith('Bearer ') ? header.slice(7) : null;

        if (!token) {
        if (required) return res.status(401).json({ message: 'Token requerido' });
        req.user = null;
        return next();
        }

        try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = payload; // contiene { id, correo, rol_nombre }
        next();
        } catch (err) {
        return res.status(401).json({ message: 'Token inválido o expirado' });
        }
    };
}
