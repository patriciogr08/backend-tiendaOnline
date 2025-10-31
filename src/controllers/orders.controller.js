// src/controllers/orders.controller.js
import { pool } from '../config/db.js';

export const OrdersController = {
    async adminList(req, res) {
        try {
        const q       = (req.query.q || '').trim();
        const estadoQ = (req.query.estado || '').trim();        // ej: 'PENDIENTE' o 'PENDIENTE,ASIGNADO'
        const pagoQ   = (req.query.pago_estado || '').trim();   // 'PENDIENTE' | 'PAGADO' 
        const fdesde  = (req.query.fdesde || '').trim();
        const fhasta  = (req.query.fhasta || '').trim();
        const limit   = Math.min(parseInt(req.query.limit || '20', 10), 100);
        const offset  = Math.max(parseInt(req.query.offset || '0', 10), 0);

        const params = [];
        let where = `WHERE p.numero IS NOT NULL`;

        if (q) {
            where += ` AND (p.numero LIKE ? OR u.nombre_completo LIKE ? OR u.correo LIKE ? OR u.telefono LIKE ?)`;
            params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
        }

        if (estadoQ) {
            const estados = estadoQ.split(',').map(s => s.trim()).filter(Boolean);
            if (estados.length === 1) { where += ` AND p.estado = ?`; params.push(estados[0]); }
            else if (estados.length > 1) {
            where += ` AND p.estado IN (${estados.map(()=>'?').join(',')})`;
            params.push(...estados);
            }
        }

        if (pagoQ) { where += ` AND pay.pago_estado = ?`; params.push(pagoQ); }

        if (fdesde) { where += ` AND p.created_at >= ?`; params.push(`${fdesde} 00:00:00`); }
        if (fhasta) { where += ` AND p.created_at <= ?`; params.push(`${fhasta} 23:59:59`); }

        const [rows] = await pool.query(
            `
            SELECT
            p.id, p.numero, p.usuario_id, p.estado, p.moneda,
            p.subtotal, p.descuento, p.envio, p.impuesto, p.total,
            p.created_at, p.updated_at,
            u.nombre_completo AS cliente_nombre, u.correo AS cliente_correo, u.telefono AS cliente_telefono
            FROM pedido p
            JOIN usuario u ON u.id = p.usuario_id
            ${where}
            ORDER BY p.id DESC   -- más recientes primero
            LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        res.json(rows);
        } catch (e) {
            console.error('OrdersController.adminList', e);
            res.status(500).json({ message: 'Error al obtener pedidos' });
        }
    },

    async GetById(req, res) {
        try {
        const id = parseInt(req.params.id, 10);

        const [hdr] = await pool.query(
            `
            SELECT
            p.id, p.numero, p.usuario_id, p.estado, p.moneda,
            p.subtotal, p.descuento, p.envio, p.impuesto, p.total,
            p.direccion_facturacion_id, p.direccion_envio_id,
            p.created_at, p.updated_at,
            u.nombre_completo AS cliente_nombre, u.correo AS cliente_correo, u.telefono AS cliente_telefono
            FROM pedido p
            JOIN usuario u ON u.id = p.usuario_id
            WHERE p.id = ?
            LIMIT 1`,
            [id]
        );
        if (!hdr.length) return res.status(404).json({ message: 'Pedido no encontrado' });

        const [items] = await pool.query(
            `SELECT id, producto_id, cantidad, precio_unitario, descuento, impuesto, total,
                    producto_nombre_snapshot AS producto_nombre,
                    producto_foto_snapshot   AS producto_foto
            FROM detalle_pedido
            WHERE pedido_id = ?
            ORDER BY id ASC`,
            [id]
        );

        const [pagos] = await pool.query(
            `SELECT id, metodo, estado, monto, comprobante_transferencia_url,
                    recibido_por_usuario_id, recibido_en, created_at, updated_at
            FROM pago
            WHERE pedido_id = ?
            ORDER BY id DESC`,
            [id]
        );
        const base = (process.env.PUBLIC_URL || '').replace(/\/+$/,''); 
        const data = pagos.map(r => {
            let url = r.comprobante_transferencia_url;
            if (url) url = `${base}${url}`;
            return { ...r, comprobante_transferencia_url: url };
        });

        res.json({ ...hdr[0], items, pagos:data });
        } catch (e) {
        console.error('OrdersController.adminGetById', e);
        res.status(500).json({ message: 'Error al obtener el pedido' });
        }
    },

    async myList(req, res) {
        const userId  = req.user.id;
        const limit   = Math.min(parseInt(req.query.limit || '20', 10), 100);
        const offset  = Math.max(parseInt(req.query.offset || '0', 10), 0);
        try {
            const [rows] = await pool.query(
                `SELECT
                    p.id, p.numero, p.usuario_id, p.estado, p.moneda,
                    p.subtotal, p.descuento, p.envio, p.impuesto, p.total,
                    p.created_at, p.updated_at,
                    u.nombre_completo AS cliente_nombre, u.correo AS cliente_correo, u.telefono AS cliente_telefono
                FROM pedido p
                JOIN usuario u ON u.id = p.usuario_id
                WHERE p.usuario_id = ?
                ORDER BY p.id DESC   -- más recientes primero
                LIMIT ? OFFSET ?`,[userId, limit, offset]
            );

        res.json(rows);
        } catch (e) {
        console.error('OrdersController.myList', e);
        res.status(500).json({ message: 'Error al obtener pedidos del usuario' });
        }
    },
    
    async adminCouriers(req, res) {
        try {
            const q = (req.query.q || '').trim();
            const params = [];
            let where = `WHERE u.deleted_at IS NULL AND u.estado='ACTIVE' AND r.nombre='REPARTIDOR'`;
            if (q) {
                where += ` AND (u.nombre_completo LIKE ? OR u.correo LIKE ? OR u.telefono LIKE ?)`;
                params.push(`%${q}%`, `%${q}%`, `%${q}%`);
            }
            const [rows] = await pool.query(
                `SELECT u.id, u.nombre_completo, u.correo, u.telefono
                FROM usuario u JOIN rol r ON r.id=u.rol_id
                ${where}
                ORDER BY u.nombre_completo ASC`,
                params
            );
            res.json(rows);
        } catch (e) {
            console.error('OrdersController.adminCouriers', e);
            res.status(500).json({ message: 'Error al listar repartidores' });
        }
    },

    async adminAssign(req, res) {
        const id = parseInt(req.params.id, 10);
        const { repartidor_usuario_id, notas = null } = req.body || {};
        if (!repartidor_usuario_id) return res.status(400).json({ message: 'repartidor_usuario_id es requerido' });

        const cx = await pool.getConnection();
        try {
            // 1) Pedido pendiente
            const [pRows] = await cx.query(`SELECT id, estado FROM pedido WHERE id=? LIMIT 1`, [id]);
            if (!pRows.length) { return res.status(404).json({ message: 'Pedido no encontrado' }); }
            if (pRows[0].estado !== 'PENDIENTE') {
                return res.status(409).json({ message: 'Solo se pueden asignar pedidos en estado PENDIENTE' });
            }

            // 2) Validar repartidor
            const [rRows] = await cx.query(
                `SELECT u.id 
                FROM usuario u JOIN rol r ON r.id=u.rol_id
                WHERE u.id=? AND u.estado='ACTIVE' AND u.deleted_at IS NULL AND r.nombre='REPARTIDOR' LIMIT 1`,
                [repartidor_usuario_id]
            );
            if (!rRows.length) { return res.status(400).json({ message: 'Repartidor inválido' }); }

            // 3) Ver si ya tiene envío creado
            const [eRows] = await cx.query(`SELECT id FROM envio WHERE pedido_id=? LIMIT 1`, [id]);
            if (eRows.length) {
                return res.status(409).json({ message: 'El pedido ya tiene un envío creado' });
            }

            await cx.beginTransaction();
            // 4) Crear envío y actualizar pedido
            const [ins] = await cx.query(
                `INSERT INTO envio (pedido_id, repartidor_usuario_id, estado, notas, asignado_en)
                VALUES (?, ?, 'ASIGNADO', ?, NOW())`,
                [id, repartidor_usuario_id, notas]
            );

            await cx.query(`UPDATE pedido SET estado='ASIGNADO', updated_at=CURRENT_TIMESTAMP WHERE id=?`, [id]);

            await cx.commit(); cx.release();
            res.status(201).json({ envio_id: ins.insertId, pedido_id: id, estado_pedido: 'ASIGNADO' });
        } catch (e) {
            await cx.rollback();
            console.error('OrdersController.adminAssign', e);
            res.status(500).json({ message: 'Error al asignar repartidor' });
        }finally{
            cx.release();
        }
    }

};
