import { verifyAccessToken } from '../utils/jwt.js';

export function requireAuth(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No autorizado' });
  }
  try {
    req.user = verifyAccessToken(h.slice(7));
    next();
  } catch {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
}
