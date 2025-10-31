import { pool } from '../config/db.js';

function calcFinalPrice(p) {
    const precio = Number(p.precio || 0);
    if (!p.tiene_descuento) return precio;
    if (p.porcentaje) return +(precio * (1 - Number(p.porcentaje)/100)).toFixed(2);
    if (p.descuento)  return +(precio - Number(p.descuento)).toFixed(2);
    return precio;
}

export const CartController = {
    // Obtiene el carrito ABIERTO del usuario, o lo crea
    async getOrCreate(req, res) {
        try {
        const userId = req.user.id;
        const moneda = req.query.moneda || 'USD';

        let [rows] = await pool.query(
            `SELECT * FROM carrito WHERE usuario_id = ? AND estado = 'ABIERTO' AND deleted_at IS NULL LIMIT 1`,
            [userId]
        );

        if (!rows.length) {
            const [ins] = await pool.query(
            `INSERT INTO carrito (usuario_id, estado, moneda) VALUES (?, 'ABIERTO', ?)`,
            [userId, moneda]
            );
            [rows] = await pool.query(`SELECT * FROM carrito WHERE id = ?`, [ins.insertId]);
        }

        const cart = rows[0];

        const [items] = await pool.query(
            `SELECT ci.id, ci.producto_id, ci.cantidad, ci.precio_unitario, ci.descuento, ci.total,
                    p.nombre, p.foto_url
            FROM item_carrito ci
            JOIN producto p ON p.id = ci.producto_id
            WHERE ci.carrito_id = ?`,
            [cart.id]
        );

        const base = (process.env.PUBLIC_URL || '').replace(/\/+$/,''); 
        const data = items.map(r => {
            let url = r.foto_url;
            if (url) url = `${base}${url}`;
            return { ...r, foto_url: url };
        });

        const total = items.reduce((acc, x) => acc + Number(x.total || 0), 0);
        res.json({ cart, items : data, total });
        } catch (e) {
        console.error('Cart.getOrCreate', e);
        res.status(500).json({ message: 'Error al obtener el carrito' });
        }
    },

    // Agrega o actualiza un item (acumula cantidad si ya existe)
    async addItem(req, res) {
        try {
        const userId = req.user.id;
        const { producto_id, cantidad = 1 } = req.body || {};
        if (!producto_id || Number(cantidad) <= 0) {
            return res.status(400).json({ message: 'El producto seleccionado debe ser mayor a 0' });
        }

        // 1) cart
        let [rows] = await pool.query(
            `SELECT * FROM carrito WHERE usuario_id = ? AND estado = 'ABIERTO' AND deleted_at IS NULL LIMIT 1`,
            [userId]
        );
        let cart = rows[0];
        if (!cart) {
            const [ins] = await pool.query(
            `INSERT INTO carrito (usuario_id, estado, moneda) VALUES (?, 'ABIERTO', 'USD')`,
            [userId]
            );
            [rows] = await pool.query(`SELECT * FROM carrito WHERE id = ?`, [ins.insertId]);
            cart = rows[0];
        }

        // 2) producto y precio final
        const [prodRows] = await pool.query(
            `SELECT id, nombre, precio, tiene_descuento, descuento, porcentaje
            FROM producto WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
            [producto_id]
        );
        if (!prodRows.length) return res.status(404).json({ message: 'Producto no encontrado' });

        const p = prodRows[0];
        const finalUnit = calcFinalPrice(p);
        const lineTotal = +(finalUnit * Number(cantidad)).toFixed(2);
        const unitDiscount = +(Number(p.precio) - finalUnit).toFixed(2);

        // 3) upsert del item (acumula cantidad)
        const [existingRows] = await pool.query(
            `SELECT * FROM item_carrito WHERE carrito_id = ? AND producto_id = ? LIMIT 1`,
            [cart.id, producto_id]
        );

        if (existingRows.length) {
            const item = existingRows[0];
            const newQty = Number(item.cantidad) + Number(cantidad);
            const newTotal = +(finalUnit * newQty).toFixed(2);
            await pool.query(
            `UPDATE item_carrito SET cantidad = ?, precio_unitario = ?, descuento = ?, total = ? WHERE id = ?`,
            [newQty, finalUnit, unitDiscount, newTotal, item.id]
            );
        } else {
            await pool.query(
            `INSERT INTO item_carrito (carrito_id, producto_id, cantidad, precio_unitario, descuento, total)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [cart.id, producto_id, cantidad, finalUnit, unitDiscount, lineTotal]
            );
        }

        return CartController.getOrCreate(req, res);
        } catch (e) {
        console.error('Cart.addItem', e);
        res.status(500).json({ message: 'Error al agregar un item al carrito' });
        }
    },

    // Cambia cantidad
    async updateItem(req, res) {
        try {
        const userId = req.user.id;
        const itemId = Number(req.params.itemId);
        const { cantidad } = req.body || {};
        if (!itemId || Number(cantidad) <= 0) {
            return res.status(400).json({ message: 'La cantidad tiene que ser mayor a 0' });
        }

        // verifica pertenencia del item al cart del usuario
        const [rows] = await pool.query(
            `SELECT ci.*, p.precio, p.tiene_descuento, p.descuento, p.porcentaje
                FROM item_carrito ci
                JOIN carrito c ON c.id = ci.carrito_id
                JOIN producto p ON p.id = ci.producto_id
                WHERE ci.id = ? AND c.usuario_id = ? AND c.estado = 'ABIERTO'`,
            [itemId, userId]
        );
        if (!rows.length) return res.status(404).json({ message: 'Item not found' });

        const r = rows[0];
        const finalUnit = calcFinalPrice(r);
        const unitDiscount = +(Number(r.precio) - finalUnit).toFixed(2);
        const newTotal = +(finalUnit * Number(cantidad)).toFixed(2);

        await pool.query(
            `UPDATE item_carrito SET cantidad = ?, precio_unitario = ?, descuento = ?, total = ? WHERE id = ?`,
            [cantidad, finalUnit, unitDiscount, newTotal, itemId]
        );

        return CartController.getOrCreate(req, res);
        } catch (e) {
        console.error('Cart.updateItem', e);
        res.status(500).json({ message: 'Error al actualizar el item del carrito' });
        }
    },

    // Elimina item
    async removeItem(req, res) {
        try {
        const userId = req.user.id;
        const itemId = Number(req.params.itemId);

        const [del] = await pool.query(
            `DELETE ci FROM item_carrito ci
            JOIN carrito c ON c.id = ci.carrito_id
            WHERE ci.id = ? AND c.usuario_id = ? AND c.estado = 'ABIERTO'`,
            [itemId, userId]
        );
        if (del.affectedRows === 0) return res.status(404).json({ message: 'Item no encontrado' });

        return CartController.getOrCreate(req, res);
        } catch (e) {
        console.error('Cart.removeItem', e);
        res.status(500).json({ message: 'Error al eliminar un item' });
        }
    },

    // Vaciar carrito
    async clear(req, res) {
        try {
        const userId = req.user.id;
        const [cartRows] = await pool.query(
            `SELECT id FROM carrito WHERE usuario_id = ? AND estado = 'ABIERTO' LIMIT 1`,
            [userId]
        );
        if (!cartRows.length) return res.json({ cart: null, items: [], total: 0 });

        const cartId = cartRows[0].id;
        await pool.query(`DELETE FROM item_carrito WHERE carrito_id = ?`, [cartId]);
        return CartController.getOrCreate(req, res);
        } catch (e) {
        console.error('Cart.clear', e);
        res.status(500).json({ message: 'Error al limpiar el carrito' });
        }
    },

    // Checkout simple: marca el carrito y devuelve id (luego lo ligamos a "pedido")
    async checkout(req, res) {
        const userId = req.user.id;

        const cx = await pool.getConnection();
        try {
            // 1) Carrito abierto
            const [cartRows] = await cx.query(
                `SELECT id FROM carrito WHERE usuario_id = ? AND estado = 'ABIERTO' LIMIT 1`,
                [userId]
            );
            if (!cartRows.length) {
                return res.status(400).json({ message: 'No tiene carrito abierto' });
            }
            const cartId = cartRows[0].id;

            // 2) Items
            const [items] = await cx.query(
                `SELECT ic.producto_id, ic.cantidad, ic.precio_unitario, ic.descuento, ic.total,
                        p.nombre AS producto_nombre, p.foto_url AS producto_foto
                FROM item_carrito ic
                JOIN producto p ON p.id = ic.producto_id
                WHERE ic.carrito_id = ?`,
                [cartId]
            );
            if (!items.length) {
                return res.status(400).json({ message: 'El carrito está vacío' });
            }

            // 3) Totales
            const subtotal  = items.reduce((a, r) => a + (Number(r.precio_unitario) * Number(r.cantidad)), 0);
            const descuento = items.reduce((a, r) => a + Number(r.descuento || 0), 0);
            const impuesto  = items.reduce((a, r) => a + Number(r.impuesto || 0), 0);
            const envio     = 0; // si luego tienes tabla de tarifas, cámbialo aquí
            const total     = items.reduce((a, r) => a + Number(r.total), 0) || (subtotal - descuento + impuesto + envio);
            
            await cx.beginTransaction();
            // 4) Direcciones por defecto (si existen)
            const [[ship]] = await cx.query(
                `SELECT id FROM direccion WHERE usuario_id=? AND tipo='SHIPPING' AND es_predeterminada=1 LIMIT 1`,
                [userId]
            );
            const [[bill]] = await cx.query(
                `SELECT id FROM direccion WHERE usuario_id=? AND tipo='BILLING' AND es_predeterminada=1 LIMIT 1`,
                [userId]
            );
            const dirEnvioId = ship?.id ?? null;
            const dirFactId  = bill?.id ?? null;

            // 5) Crear Pedido (estado PENDIENTE)
            const moneda = 'USD';
            const [insPedido] = await cx.query(
                `INSERT INTO pedido
                (usuario_id, direccion_facturacion_id, direccion_envio_id, estado, moneda,
                subtotal, descuento, envio, impuesto, total)
                VALUES (?, ?, ?, 'PENDIENTE', ?, ?, ?, ?, ?, ?)`,
                [userId, dirFactId, dirEnvioId, moneda, subtotal, descuento, envio, impuesto, total]
            );
            const pedidoId = insPedido.insertId;

            // número legible: PED-000001
            await cx.query(
                `UPDATE pedido SET numero = CONCAT('PED-', LPAD(?, 6, '0')) WHERE id = ?`,
                [pedidoId, pedidoId]
            );

            // 6) Detalles del pedido con snapshot
            const detalleValues = items.map(r => ([
                pedidoId,
                r.producto_id,
                r.cantidad,
                r.precio_unitario,
                r.descuento || 0,
                r.impuesto || 0,
                r.total,
                r.producto_nombre,
                r.producto_foto
            ]));

            await cx.query(
                `INSERT INTO detalle_pedido
                (pedido_id, producto_id, cantidad, precio_unitario, descuento, impuesto, total,
                producto_nombre_snapshot, producto_foto_snapshot)
                VALUES ?`,
                [detalleValues]
            );

            // 7) Crear pago PENDIENTE (por defecto EFECTIVO; ajusta si manejas otro flujo)
            await cx.query(
                `INSERT INTO pago (pedido_id, metodo, estado, monto)
                VALUES (?, 'EFECTIVO', 'PENDIENTE', ?)`,
                [pedidoId, total]
            );

            // 8) Cerrar carrito
            await cx.query(`UPDATE carrito SET estado = 'PEDIDO' WHERE id = ?`, [cartId]);

            await cx.commit(); cx.release();

            // Respuesta (mantengo cart_id para no romper tu front; agrego pedido info)
            return res.json({
                ok: true,
                cart_id: cartId,
                pedido_id: pedidoId,
                numero: `PED-${String(pedidoId).padStart(6, '0')}`,
                total
            });
        } catch (e) {
            await cx.rollback(); 
            console.error('Cart.checkout', e);
            return res.status(500).json({ message: 'No se pudo procesar el checkout' });
        }finally{
            cx.release();
        }
    }
};
