import { pool } from '../config/db.js';
import { urlFor } from '../config/multer.config.js';

export const CourierController = {

    async list(req, res) {
        const courierId = req.user.id;
        try {
            const limit  = Math.min(parseInt(req.query.limit || '20', 10), 100);
            const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

            const params = [courierId];
            const estadoParam = (req.query.estado || '').trim().toUpperCase();
            let where = `WHERE e.repartidor_usuario_id = ?`;
            const estados = estadoParam ? estadoParam.split(',').map(s => s.trim()).filter(Boolean) : [];

            if (estados.length === 1) {
                where += ` AND p.estado = ?`;
                params.push(estados[0]);
            } else if (estados.length > 1) {
                where += ` AND p.estado IN (${estados.map(() => '?').join(',')})`;
                params.push(...estados);
            }

            const [rows] = await pool.query(
                `
                SELECT
                p.id, p.numero, p.usuario_id, p.estado, p.moneda,
                p.subtotal, p.descuento, p.envio, p.impuesto, p.total,
                p.created_at, p.updated_at,
                u.nombre_completo AS cliente_nombre, u.correo AS cliente_correo, u.telefono AS cliente_telefono,
                e.id AS envio_id, e.estado AS envio_estado, e.asignado_en, e.entregado_en
                FROM pedido p
                JOIN envio e ON e.pedido_id = p.id
                JOIN usuario u ON u.id = p.usuario_id
                ${where}
                ORDER BY p.id DESC
                LIMIT ? OFFSET ?`,
                [...params, limit, offset]
            );

            res.json(rows);
        } catch (e) {
            console.error('CourierController.list', e);
            res.status(500).json({ message: 'Error al obtener pedidos asignados' });
        }
    },

    async startDelivery(req, res) {
        const courierId = req.user.id;
        const pedidoId  = parseInt(req.params.id, 10);

        const cx = await pool.getConnection();
        try {

            // validar envío asignado a este courier y en estado ASIGNADO
            const [envRows] = await cx.query(
                `SELECT e.id, e.estado, p.estado AS pedido_estado
                FROM envio e JOIN pedido p ON p.id = e.pedido_id
                WHERE e.pedido_id = ? AND e.repartidor_usuario_id = ?
                LIMIT 1`,
                [pedidoId, courierId]
            );
            if (!envRows.length) {
                return res.status(404).json({ message: 'Envío no encontrado para este repartidor' });
            }
            const env = envRows[0];
            if (env.estado !== 'ASIGNADO' || env.pedido_estado !== 'ASIGNADO') {
                return res.status(409).json({ message: 'Solo pedidos ASIGNADO pueden pasar a EN_REPARTO' });
            }
            
            await cx.beginTransaction();
            await cx.query(`UPDATE envio  SET estado='EN_REPARTO', updated_at=CURRENT_TIMESTAMP WHERE pedido_id=?`, [pedidoId]);
            await cx.query(`UPDATE pedido SET estado='EN_REPARTO', updated_at=CURRENT_TIMESTAMP WHERE id=?`, [pedidoId]);

            await cx.commit(); cx.release();
            res.json({ ok: true, pedido_id: pedidoId, estado: 'EN_REPARTO' });
        } catch (e) {
            await cx.rollback();
            console.error('CourierController.startDelivery', e);
            res.status(500).json({ message: 'Error al iniciar reparto' });
        } finally {
            cx.release();
        }
    },

    // POST /courier/pedidos/:id/complete (multipart: metodo, monto, comprobante)
    async completeWithPayment(req, res) {
        const courierId = req.user.id;
        const pedidoId  = parseInt(req.params.id, 10);
        const { metodo, monto } = req.body || {};

        if (!metodo || !['EFECTIVO', 'TRANSFERENCIA'].includes(String(metodo).toUpperCase())) {
            return res.status(400).json({ message: 'Método inválido (EFECTIVO o TRANSFERENCIA)' });
        }
        const montoNum = Number(monto);
        if (!monto || Number.isNaN(montoNum) || montoNum <= 0) {
            return res.status(400).json({ message: 'Monto inválido' });
        }
        if (!req.file) {
            return res.status(400).json({ message: 'Comprobante (foto) es obligatorio' });
        }

        const comprobanteUrl =  urlFor('comprobante', req.file.filename);

        const cx = await pool.getConnection();
        try {
            // validar control
            const [envRows] = await cx.query(
                `SELECT e.id, e.estado, p.estado AS pedido_estado, p.moneda, p.total
                FROM envio e JOIN pedido p ON p.id = e.pedido_id
                WHERE e.pedido_id = ? AND e.repartidor_usuario_id = ?
                LIMIT 1`,
                [pedidoId, courierId]
            );
            if (!envRows.length) { return res.status(404).json({ message: 'Envío no encontrado para este repartidor' }); }
            
            await cx.beginTransaction();
            // 1) marcar ENTREGADO en envío
            await cx.query(
                `UPDATE envio
                SET estado='ENTREGADO', entregado_en = NOW(), updated_at=CURRENT_TIMESTAMP
                WHERE pedido_id = ?`,
                [pedidoId]
            );

            // 2) registrar pago (PAGADO)
            // buscar pago ya registrado y actualizarlo a PAGADO
            const [pagoRows] = await cx.query(
                `SELECT id FROM pago WHERE pedido_id = ? LIMIT 1 FOR UPDATE`,
                [pedidoId]
            );
            if (!pagoRows.length) {
                await cx.rollback();
                return res.status(404).json({ message: 'Pago no encontrado para este pedido' });
            }
            const pagoId = pagoRows[0].id;
            await cx.query(
                `UPDATE pago
                 SET metodo = ?, estado = 'PAGADO', monto = ?, comprobante_transferencia_url = ?, recibido_por_usuario_id = ?, recibido_en = NOW(), updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [metodo.toUpperCase(), montoNum, comprobanteUrl, courierId, pagoId]
            );

            // 3) actualizar pedido a PAGADO (ya se entregó y cobró)
            await cx.query(
                `UPDATE pedido SET estado='PAGADO', updated_at=CURRENT_TIMESTAMP WHERE id = ?`,
                [pedidoId]
            );

            await cx.commit(); cx.release();
            res.status(201).json({
                ok: true,
                pedido_id: pedidoId,
                envio_estado: 'ENTREGADO',
                pedido_estado: 'PAGADO',
                pago: { metodo: metodo.toUpperCase(), monto: montoNum, comprobante: comprobanteUrl, estado: 'PAGADO' }
            });
        } catch (e) {
            await cx.rollback();
            console.error('CourierController.completeWithPayment', e);
            res.status(500).json({ message: 'Error al completar entrega y registrar pago' });
        } finally{
            cx.release();
        }
    }
};
