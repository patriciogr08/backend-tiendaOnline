// src/controllers/addresses.controller.js
import { pool } from '../config/db.js';

async function ensureOwnership(userId, addrId) {
    const [rows] = await pool.query(
        `SELECT id, usuario_id, tipo FROM direccion WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
        [addrId]
    );
    const row = rows[0];
    if (!row) return { code: 404, error: { message: 'Dirección no encontrada' } };
    if (row.usuario_id !== userId) return { code: 403, error: { message: 'Prohibido' } };
    return { row };
}

export const AddressesController = {
    async list(req, res) {
        const userId = req.user.id;
        const [rows] = await pool.query(
            `SELECT id, tipo, destinatario, linea1, linea2, ciudad, provincia,
                    codigo_postal, pais_codigo, telefono, es_predeterminada,
                    created_at, updated_at
            FROM direccion
            WHERE usuario_id = ? AND deleted_at IS NULL
            ORDER BY tipo, es_predeterminada DESC, id`,
            [userId]
        );
        res.json(rows);
    },

    async create(req, res) {
        const userId = req.user.id;

        const {
        tipo, destinatario, linea1, linea2 = null, ciudad, provincia,
        codigo_postal = null, pais_codigo, telefono = null, es_predeterminada = false
        } = req.body || {};

        if (!tipo || !destinatario || !linea1 || !ciudad || !provincia || !pais_codigo) {
            return res.status(400).json({ message: 'Datos de dirección incompletos' });
        }

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            if (es_predeterminada) {
                await conn.query(
                `UPDATE direccion
                SET es_predeterminada = 0, updated_at = CURRENT_TIMESTAMP
                WHERE usuario_id = ? AND tipo = ? AND es_predeterminada = 1`,
                [userId, tipo]
                );
            }

            const [ins] = await conn.query(
                `INSERT INTO direccion
                (usuario_id, tipo, destinatario, linea1, linea2, ciudad, provincia,
                codigo_postal, pais_codigo, telefono, es_predeterminada)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [req.user.id, tipo, destinatario, linea1, linea2, ciudad, provincia,
                codigo_postal, pais_codigo, telefono, es_predeterminada ? 1 : 0]
            );

            await conn.commit();

            const [rows] = await pool.query(`SELECT * FROM direccion WHERE id = ?`, [ins.insertId]);
            res.status(201).json(rows[0]);
        } catch (e) {
        await conn.rollback();
            console.error(e);
            res.status(500).json({ message: 'Error creando dirección' });
        } finally {
            conn.release();
        }
    },

    async update(req, res) {
        const userId = req.user.id;
        const addrId = Number(req.params.id);
        const own = await ensureOwnership(userId, addrId);
        if (own.error) return res.status(own.code).json(own.error);

        const {
        tipo, destinatario, linea1, linea2 = null, ciudad, provincia,
        codigo_postal = null, pais_codigo, telefono = null, es_predeterminada
        } = req.body || {};

        if (!tipo || !destinatario || !linea1 || !ciudad || !provincia || !pais_codigo || typeof es_predeterminada !== 'boolean') {
        return res.status(400).json({ message: 'PUT requiere todos los campos (incl. es_predeterminada)' });
        }

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            await conn.query(
                `UPDATE direccion
                SET tipo = ?, destinatario = ?, linea1 = ?, linea2 = ?, ciudad = ?, provincia = ?,
                    codigo_postal = ?, pais_codigo = ?, telefono = ?, es_predeterminada = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?`,
                [tipo, destinatario, linea1, linea2, ciudad, provincia, codigo_postal,
                pais_codigo, telefono, es_predeterminada ? 1 : 0, addrId]
            );

            await conn.commit();

            const [rows] = await pool.query(`SELECT * FROM direccion WHERE id = ?`, [addrId]);
            res.json(rows[0]);
        } catch (e) {
            await conn.rollback();
            console.error(e);
            res.status(500).json({ message: 'Error actualizando dirección' });
        } finally {
            conn.release();
        }
    },

    async setDefault(req, res) {
        const userId = req.user.id;
        const addrId = Number(req.params.id);
        const own = await ensureOwnership(userId, addrId);
        if (own.error) return res.status(own.code).json(own.error);

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            await conn.query(
                `UPDATE direccion
                SET es_predeterminada = 0, updated_at = CURRENT_TIMESTAMP
                WHERE usuario_id = ? AND tipo = ?`,
                [userId, own.row.tipo]
            );

            await conn.query(
                `UPDATE direccion
                SET es_predeterminada = 1, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?`,
                [addrId]
            );

            await conn.commit();

            const [rows] = await pool.query(`SELECT * FROM direccion WHERE id = ?`, [addrId]);
            res.json(rows[0]);
        } catch (e) {
        await conn.rollback();
            console.error(e);
            res.status(500).json({ message: 'Error marcando predeterminada' });
        } finally {
            conn.release();
        }
    },

    async remove(req, res) {
        const userId = req.user.id;
        const addrId = Number(req.params.id);
        const own = await ensureOwnership(userId, addrId);
        if (own.error) return res.status(own.code).json(own.error);

        await pool.query(
            `UPDATE direccion
            SET deleted_at = CURRENT_TIMESTAMP, es_predeterminada = 0
            WHERE id = ?`,
            [addrId]
        );
        res.json({ message: 'Eliminada' });
    }
};
