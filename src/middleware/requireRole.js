/**
 * requireRole('ADMIN', 'REPARTIDOR', ...)
 * Verifica que el JWT tenga uno de los roles permitidos
 */
export function requireRole(...rolesPermitidos) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ message: 'No autenticado' });
        const rol = req.user.rol_nombre;
        if (!rolesPermitidos.includes(rol)) {
        return res.status(403).json({ message: 'No autorizado' });
        }
        next();
    };
}
