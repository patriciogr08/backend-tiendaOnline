import { pool } from '../config/db.js';

/**
 * requirePermission({ moduleCode: 'PRODUCTOS', action: 'read' | 'write' })
 * - Valida permiso en permiso_rol (puede_leer / puede_escribir) según el rol del usuario.
 */
export function requirePermission({ moduleCode, action }) {
    const col = action === 'write' ? 'puede_escribir' : 'puede_leer';

    return async (req, res, next) => {
        if (!req.user) return res.status(401).json({ message: 'No autenticado' });

        try {
        const [rows] = await pool.query(
            `SELECT pr.${col} AS allowed
            FROM permiso_rol pr
            JOIN rol r   ON r.id = pr.rol_id
            JOIN modulo m ON m.id = pr.modulo_id
            WHERE r.nombre = ? AND m.codigo = ? LIMIT 1`,
            [req.user.rol_nombre, moduleCode]
        );

        if (!rows.length || !rows[0].allowed) {
            return res.status(403).json({ message: 'Permiso insuficiente' });
        }

        next();
        } catch (e) {
        return res.status(500).json({ message: 'Error validando permisos', error: e.message });
        }
  };
}
