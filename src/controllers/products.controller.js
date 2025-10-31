import { pool } from '../config/db.js';
import { urlFor, MOUNT_PATH } from '../config/multer.config.js';


const PUBLIC_URL = process.env.PUBLIC_URL || 'http://localhost:3001';

function resolveUploadBase() {
    const dir = process.env.UPLOAD_DIR || 'public/images';
    return path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
}

export const ProductController = {
    // Metadata for forms (product types)
    async meta(_req, res) {
        try {
            const [types] = await pool.query(
                `SELECT id, nombre FROM tipo_producto WHERE activo = 1 ORDER BY nombre ASC`
            );
        res.json({ product_types: types });
        } catch (e) {
            console.error('Producto.meta', e);
            res.status(500).json({ message: 'Error al obtener la metadata' });
        }
    },

    async list(req, res) {
        try {
            const q      = (req.query.q || '').trim();
            const limit  = Math.min(parseInt(req.query.limit || '20', 10), 100);
            const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);
            // soporta ?tipo=1 o ?tipo=1,2,3 o ?tipos=1,2,3
            const tipoParam = req.query.tipo ?? null;
            let tipo = null;
            let tiposArray = null;
            if (tipoParam != null) {
                if (typeof tipoParam === 'string' && tipoParam.includes(',')) {
                    tiposArray = tipoParam.split(',').map(s => parseInt(s, 10)).filter(n => !Number.isNaN(n));
                } else {
                    const n = parseInt(tipoParam, 10);
                    tipo = Number.isNaN(n) ? null : n;
                }
            }
            const publicado = req.query.publicado === '1' ? 1 : req.query.publicado === '0' ? 0 : null; 

            const params = [];
            let where = 'WHERE p.deleted_at IS NULL';
            if (q) {
                where += ' AND (p.nombre LIKE ? OR p.descripcion LIKE ?)';
                params.push(`%${q}%`, `%${q}%`);
            }
            if (publicado != null) {
                where += ' AND p.publicado = ?';
                params.push(publicado);
            }

            if (tipo != null) {
                where += ' AND p.tipo_producto_id = ?';
                params.push(tipo);
            } else if (tiposArray != null && tiposArray.length > 0) {
                const placeholders = tiposArray.map(() => '?').join(',');
                where += ` AND p.tipo_producto_id IN (${placeholders})`;
                params.push(...tiposArray);
            }

            const [rows] = await pool.query(
                `SELECT p.id, p.tipo_producto_id, p.nombre, p.descripcion, p.foto_url,
                        p.precio, p.tiene_descuento, p.descuento, p.porcentaje, p.publicado,
                        p.created_at, p.updated_at,
                        tp.nombre AS tipo_nombre
                FROM producto p
                LEFT JOIN tipo_producto tp ON tp.id = p.tipo_producto_id
                ${where}
                ORDER BY p.id DESC
                LIMIT ? OFFSET ?`,
                [...params, limit, offset]
            );

            const base = (process.env.PUBLIC_URL || '').replace(/\/+$/,''); 
            const data = rows.map(r => {
                let url = r.foto_url;
                if (url) url = `${base}${url}`;
                return { ...r, foto_url: url };
            });

            return res.json(data);

        } catch (e) {
            console.error('Producto.list', e);
            res.status(500).json({ message: 'Error al obtener el listado de productos' });
        }
    },

    async create(req, res) {
        try {
        const {
            tipo_producto_id = null,
            nombre,
            descripcion = null,
            precio,
            tiene_descuento = 0,
            descuento = 0,
            porcentaje = 0,
            publicado = 0
        } = req.body || {};

        if (!nombre || precio == null) {
            return res.status(400).json({ message: 'nombre y precio are required' });
        }

        // URL pública coherente con app.use(MOUNT_PATH, express.static(...))
        let foto_url = null;
        if (req.file) {
            // /images/products/<filename>
            foto_url = urlFor('products', req.file.filename);
            // Si quieres absoluta:
            // foto_url = `${req.protocol}://${req.get('host')}${urlFor('products', req.file.filename)}`;
        }

        const [result] = await pool.query(
            `INSERT INTO producto
            (tipo_producto_id, nombre, descripcion, foto_url, precio, tiene_descuento, descuento, porcentaje, publicado)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [tipo_producto_id, nombre, descripcion, foto_url, precio, tiene_descuento, descuento, porcentaje, publicado]
        );

        const [row] = await pool.query(
            `SELECT id, tipo_producto_id, nombre, descripcion, foto_url, precio,
                    tiene_descuento, descuento, porcentaje, publicado, created_at, updated_at
            FROM producto WHERE id = ?`,
            [result.insertId]
        );

        return res.status(201).json(row[0]);
        } catch (e) {
        console.error('Producto.create', e);
        return res.status(500).json({ message: 'Error al crear el producto' });
        }
    },

    async update(req, res) {
        try {
        const id = parseInt(req.params.id, 10);
        const [curRows] = await pool.query(
            `SELECT * FROM producto WHERE id = ? AND deleted_at IS NULL LIMIT 1`, [id]
        );
        if (!curRows.length) return res.status(404).json({ message: 'Product not found' });
        const curr = curRows[0];

        const {
            tipo_producto_id,
            nombre,
            descripcion,
            precio,
            tiene_descuento,
            descuento,
            porcentaje,
            publicado
        } = req.body || {};

        // Construir siguiente estado
        const next = {
            tipo_producto_id: tipo_producto_id ?? curr.tipo_producto_id,
            nombre:           nombre ?? curr.nombre,
            descripcion:      descripcion ?? curr.descripcion,
            foto_url:         curr.foto_url, // se reemplaza solo si llega file
            precio:           precio ?? curr.precio,
            tiene_descuento:  tiene_descuento ?? curr.tiene_descuento,
            descuento:        descuento ?? curr.descuento,
            porcentaje:       porcentaje ?? curr.porcentaje,
            publicado:        publicado ?? curr.publicado
        };

        let prevFotoUrl = curr.foto_url;

        if (req.file) {
            // Nueva foto pública
            next.foto_url = urlFor('products', req.file.filename);
            // Si la anterior era local bajo MOUNT_PATH, borrarla
            try {
            if (prevFotoUrl) {
                const mount = MOUNT_PATH.replace(/\/+$/, ''); // ej: '/images'
                const re = new RegExp(`^${mount.replace('/', '\\/')}/?`); // ^/images/
                if (re.test(prevFotoUrl)) {
                // prev '/images/products/xxx.png' -> 'products/xxx.png'
                const rel = prevFotoUrl.replace(re, '');
                const abs = path.join(resolveUploadBase(), rel); // .../public/images/products/xxx.png
                fs.unlink(abs, () => {});
                }
            }
            } catch { /* noop */ }
        }

        await pool.query(
            `UPDATE producto
            SET tipo_producto_id=?, nombre=?, descripcion=?, foto_url=?, precio=?, tiene_descuento=?,
                descuento=?, porcentaje=?, publicado=?, updated_at = CURRENT_TIMESTAMP
            WHERE id=?`,
            [
            next.tipo_producto_id, next.nombre, next.descripcion, next.foto_url, next.precio,
            next.tiene_descuento, next.descuento, next.porcentaje, next.publicado, id
            ]
        );

        const [row] = await pool.query(
            `SELECT id, tipo_producto_id, nombre, descripcion, foto_url, precio,
                    tiene_descuento, descuento, porcentaje, publicado, created_at, updated_at
            FROM producto WHERE id = ?`,
            [id]
        );
        return res.json(row[0]);
        } catch (e) {
        console.error('Producto.update', e);
        return res.status(500).json({ message: 'Failed to update product' });
        }
    },

    async remove(req, res) {
        try {
            const id = parseInt(req.params.id, 10);
            // Soft delete si prefieres:
            const [r] = await pool.query(`UPDATE producto SET deleted_at = NOW() WHERE id = ?`, [id]);
            if (r.affectedRows === 0) return res.status(404).json({ message: 'Product not found' });
            res.json({ message: 'OK' });
        } catch (e) {
            console.error('Producto.remove', e);
            res.status(500).json({ message: 'Error al borrar el producto' });
        }
    }
};
