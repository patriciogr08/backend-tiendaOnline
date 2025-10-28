import { pool } from '../config/db.js';

export const ProductTypeController = {
  async list(_req, res) {
        try {
        const [rows] = await pool.query(
                `SELECT id, nombre, descripcion, activo, created_at, updated_at
                FROM tipo_producto
                WHERE activo = 1
                ORDER BY nombre ASC`
        );
        res.json(rows);
        } catch (e) {
        console.error('ProductType.list', e);
        res.status(500).json({ message: 'Failed to list product types' });
        }
    }
};
