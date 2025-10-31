// src/controllers/admin.users.controller.js
import { pool } from '../config/db.js';
import { hashPassword } from '../utils/hash.js';

export const UsersController = {
    async list(req, res) {
        const q = (req.query.q || '').trim();
        const estado = (req.query.estado || '').toUpperCase();
        const limit  = Math.min(parseInt(req.query.limit || '20', 10), 100);
        const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

        const params = [];
        let where = `WHERE u.deleted_at IS NULL`;

        // Excluir ADMIN
        where += ` AND r.nombre <> 'ADMIN'`;

        if (q) {
            where += ` AND (u.nombre_completo LIKE ? OR u.correo LIKE ? OR u.telefono LIKE ?)`;
            params.push(`%${q}%`, `%${q}%`, `%${q}%`);
        }
            if (estado === 'ACTIVE' || estado === 'BLOCKED') {
            where += ` AND u.estado = ?`;
            params.push(estado);
        }

        const [rows] = await pool.query(
            `SELECT u.id, u.nombre_completo, u.correo, u.telefono, u.estado,
                    u.rol_id, r.nombre AS rol, u.created_at, u.updated_at
            FROM usuario u
            JOIN rol r ON r.id = u.rol_id
            ${where}
            ORDER BY u.id DESC
            LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        res.json(rows);
    },

    // POST /admin/users  (crear REPARTIDOR)
    async createRepartidor(req, res) {
        const {
        nombre_completo,
        correo,
        telefono = null,
        contrasena
        } = req.body || {};

        if (!nombre_completo || !correo || !contrasena) {
            return res.status(400).json({ message: 'nombre_completo, correo y contrasena son requeridos' });
        }

        const [exists] = await pool.query(`SELECT id FROM usuario WHERE correo = ? LIMIT 1`, [correo]);
        if (exists.length) return res.status(409).json({ message: 'Correo ya registrado' });

        const hash = await hashPassword(contrasena);

        // buscar rol REPARTIDOR
        const [rol] = await pool.query(`SELECT id FROM rol WHERE UPPER(nombre)=UPPER('REPARTIDOR') LIMIT 1`);
        if (!rol.length) return res.status(500).json({ message: 'No existe rol REPARTIDOR' });

        const [ins] = await pool.query(
            `INSERT INTO usuario (correo, contrasena_hash, nombre_completo, telefono, estado, rol_id)
            VALUES (?, ?, ?, ?, 'ACTIVE', ?)`,
            [correo, hash, nombre_completo, telefono, rol[0].id]
        );

        const [row] = await pool.query(
            `SELECT u.id, u.nombre_completo, u.correo, u.telefono, u.estado, u.rol_id, r.nombre AS rol, u.created_at, u.updated_at
            FROM usuario u JOIN rol r ON r.id = u.rol_id WHERE u.id = ? LIMIT 1`,
            [ins.insertId]
        );

        res.status(201).json(row[0]);
    },

    // PUT /admin/users/:id/status  { estado: 'ACTIVE' | 'BLOCKED' }
    async setStatus(req, res) {
        const id = parseInt(req.params.id, 10);
        const { estado } = req.body || {};
        if (!['ACTIVE', 'BLOCKED'].includes(estado)) {
            return res.status(400).json({ message: 'Estado inválido' });
        }

        // No permitir cambiar estado a ADMIN
        const [chk] = await pool.query(
            `SELECT u.id, r.nombre AS rol FROM usuario u JOIN rol r ON r.id=u.rol_id WHERE u.id = ? LIMIT 1`,
            [id]
        );
        if (!chk.length) return res.status(404).json({ message: 'Usuario no encontrado' });
        if (chk[0].rol === 'ADMIN') return res.status(403).json({ message: 'No se puede bloquear/desbloquear ADMIN' });

        await pool.query(
            `UPDATE usuario SET estado=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
            [estado, id]
        );

        const [row] = await pool.query(
            `SELECT u.id, u.nombre_completo, u.correo, u.telefono, u.estado, u.rol_id, r.nombre AS rol, u.created_at, u.updated_at
            FROM usuario u JOIN rol r ON r.id = u.rol_id WHERE u.id = ? LIMIT 1`,
            [id]
        );

        res.json(row[0]);
    },

    async updateBasic(req, res) {
        const id = parseInt(req.params.id, 10);
        const { nombre_completo, telefono = null } = req.body || {};
        if (!nombre_completo) return res.status(400).json({ message: 'nombre_completo requerido' });

        const [chk] = await pool.query(
            `SELECT u.id, r.nombre rol FROM usuario u JOIN rol r ON r.id=u.rol_id WHERE u.id=? LIMIT 1`, [id]
        );
        if (!chk.length) return res.status(404).json({ message: 'Usuario no encontrado' });
        if (chk[0].rol === 'ADMIN') return res.status(403).json({ message: 'No se puede editar ADMIN' });

        await pool.query(
            `UPDATE usuario SET nombre_completo=?, telefono=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
            [nombre_completo, telefono, id]
        );

        const [row] = await pool.query(
            `SELECT u.id, u.nombre_completo, u.correo, u.telefono, u.estado, u.rol_id, r.nombre AS rol, u.created_at, u.updated_at
            FROM usuario u JOIN rol r ON r.id = u.rol_id WHERE u.id=? LIMIT 1`, [id]
        );
        res.json(row[0]);
    }

};
