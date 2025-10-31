/**
 * requireRole('ADMIN', 'REPARTIDOR', ...)
 * - Si no pasas roles => solo exige estar autenticado (útil para rutas "auth-only").
 * - Acepta req.user.rol, req.user.rol_nombre o req.user.role
 */
export function requireRole(...allowedRoles) {
    const allowed = new Set((allowedRoles || []).map(r => String(r).toUpperCase()));

    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ message: 'No autenticado' });

        const rawRole = req.user.rol ?? req.user.rol_nombre ?? req.user.role;
        if (!rawRole) return res.status(403).json({ message: 'No autorizado' });

        if (allowed.size === 0) return next(); // solo autenticado

        const role = String(rawRole).toUpperCase();
        if (!allowed.has(role)) return res.status(403).json({ message: 'No autorizado' });

        next();
    };
}
