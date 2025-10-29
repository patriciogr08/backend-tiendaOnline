import { pool } from '../config/db.js';
import { verifyPassword } from '../utils/hash.js';
import { signAccessToken } from '../utils/jwt.js';

export const AuthController = {
    async login(req, res) {
        const { correo, password } = req.body || {};
        if (!correo || !password) return res.status(400).json({ message: 'Datos incompletos' });

        const [rows] = await pool.query(
            `SELECT u.id, u.nombre_completo, u.correo, u.telefono, u.estado, u.rol_id,
                    u.contrasena_hash,
                    r.nombre AS rol
            FROM usuario u
            JOIN rol r ON r.id = u.rol_id
            WHERE u.correo = ? AND u.estado = 'ACTIVE'
            LIMIT 1`,
            [correo]
        );
        if (!rows.length) return res.status(401).json({ message: 'Credenciales inválidas' });

        const row = rows[0];
        const ok = await verifyPassword(password, row.contrasena_hash);
        if (!ok) return res.status(401).json({ message: 'Credenciales inválidas' });

        // Usuario tal cual BD (sin contrasena_hash)
        const user = {
            id: row.id,
            nombre_completo: row.nombre_completo,
            correo: row.correo,
            rol_id: row.rol_id,
            rol: row.rol
        };

        const accessToken = signAccessToken({
            id: user.id,
            correo: user.correo,
            rol: user.rol,
            nombre_completo: user.nombre_completo
        });

        return res.json({ accessToken, user });
    },

    async me(req, res) {
        const userJwt = req.user;
        const [rows] = await pool.query(
            `SELECT u.id, u.nombre_completo, u.correo, u.telefono, u.estado, u.rol_id,
                    r.nombre AS rol
            FROM usuario u
            JOIN rol r ON r.id = u.rol_id
            WHERE u.id = ? LIMIT 1`,
            [userJwt.sub]
        );
        if (!rows.length) return res.status(404).json({ message: 'Usuario no encontrado' });
        return res.json(rows[0]); // snake_case tal cual
    },

    async logout(_req, res) {
        // Stateless: el frontend elimina el token
        return res.json({ message: 'OK' });
    }
};
