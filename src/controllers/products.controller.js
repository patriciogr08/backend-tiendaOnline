import Joi from 'joi';
import { pool } from '../config/db.js';

// Validación acorde a tus columnas
const productSchema = Joi.object({
    tipo_producto_id: Joi.number().integer().required(),
    nombre: Joi.string().max(200).required(),
    descripcion: Joi.string().allow('', null),
    foto_url: Joi.string().uri().allow('', null),
    precio: Joi.number().precision(2).positive().required(),
    tiene_descuento: Joi.boolean().default(false),
    descuento: Joi.number().precision(2).min(0).default(0),
    porcentaje: Joi.number().precision(2).min(0).max(100).default(0),
    publicado: Joi.boolean().default(false)
});

// GET /api/products?published=1
export async function listProducts(req, res) {
    const publishedOnly = String(req.query.published ?? '1') === '1';
    const where = publishedOnly
        ? 'WHERE p.publicado = 1 AND p.deleted_at IS NULL'
        : 'WHERE p.deleted_at IS NULL';

    const [rows] = await pool.query(
        `SELECT p.id, p.tipo_producto_id, tp.nombre AS tipo_producto,
                p.nombre, p.descripcion, p.foto_url,
                p.precio, p.tiene_descuento, p.descuento, p.porcentaje,
                p.publicado, p.created_at, p.updated_at
        FROM producto p
        JOIN tipo_producto tp ON tp.id = p.tipo_producto_id
        ${where}
        ORDER BY p.created_at DESC`
    );
    res.json(rows);
}

// GET /api/products/:id
export async function getProduct(req, res) {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID inválido' });

    const [[row]] = await pool.query(
        `SELECT p.*, tp.nombre AS tipo_producto
        FROM producto p
        JOIN tipo_producto tp ON tp.id = p.tipo_producto_id
        WHERE p.id = ? AND p.deleted_at IS NULL`,
        [id]
    );
    if (!row) return res.status(404).json({ message: 'No encontrado' });
    res.json(row);
}

// POST /api/products  (ADMIN)
export async function createProduct(req, res) {
    const { error, value } = productSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const v = value;
    try {
        const [r] = await pool.query(
        `INSERT INTO producto(
            tipo_producto_id, nombre, descripcion, foto_url,
            precio, tiene_descuento, descuento, porcentaje,
            publicado
        ) VALUES (?,?,?,?,?,?,?,?,?)`,
        [
            v.tipo_producto_id, v.nombre, v.descripcion ?? null, v.foto_url ?? null,
            v.precio, v.tiene_descuento ? 1 : 0, v.descuento, v.porcentaje,
            v.publicado ? 1 : 0
        ]
        );
        res.status(201).json({ id: r.insertId });
    } catch (e) {
        res.status(500).json({ message: 'Error creando producto', error: e.message });
    }
}

// PUT /api/products/:id  (ADMIN)
export async function updateProduct(req, res) {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID inválido' });

    const { error, value } = productSchema.min(1).validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const fields = [];
    const params = [];
    for (const [k, v] of Object.entries(value)) {
        fields.push(`${k} = ?`);
        params.push(typeof v === 'boolean' ? (v ? 1 : 0) : v);
    }
    if (!fields.length) return res.status(400).json({ message: 'Nada que actualizar' });

    try {
        const [r] = await pool.query(
        `UPDATE producto SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND deleted_at IS NULL`,
        [...params, id]
        );
        if (!r.affectedRows) return res.status(404).json({ message: 'No encontrado' });
        res.json({ updated: true });
    } catch (e) {
        res.status(500).json({ message: 'Error actualizando', error: e.message });
    }
}

// DELETE /api/products/:id  (ADMIN) – borrado lógico
export async function deleteProduct(req, res) {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID inválido' });

    try {
        const [r] = await pool.query(
        `UPDATE producto SET deleted_at = NOW(), publicado = 0
        WHERE id = ? AND deleted_at IS NULL`,
        [id]
        );
        if (!r.affectedRows) return res.status(404).json({ message: 'No encontrado' });
        res.json({ deleted: true });
    } catch (e) {
        res.status(500).json({ message: 'Error eliminando', error: e.message });
    }
}
