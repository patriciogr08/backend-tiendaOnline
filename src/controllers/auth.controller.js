import Joi from 'joi';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
import { comparePassword } from '../utils/hash.js';

const loginSchema = Joi.object({
    correo: Joi.string().email().required(),
    contrasena: Joi.string().required()
});

export async function login(req, res) {
    const { error, value } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const { correo, contrasena } = value;

    const [rows] = await pool.query(
        `SELECT u.id, u.contrasena_hash, u.estado, r.nombre AS rol_nombre
        FROM usuario u
        JOIN rol r ON r.id = u.rol_id
        WHERE u.correo = ? LIMIT 1`,
        [correo]
    );

    if (!rows.length) return res.status(401).json({ message: 'Credenciales inválidas' });

    const user = rows[0];
    if (user.estado !== 'ACTIVE') return res.status(403).json({ message: 'Usuario bloqueado' });

    const ok = comparePassword(contrasena, user.contrasena_hash);
    if (!ok) return res.status(401).json({ message: 'Credenciales inválidas' });

    const token = jwt.sign(
        { id: user.id, correo, rol_nombre: user.rol_nombre },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({ token });
}
