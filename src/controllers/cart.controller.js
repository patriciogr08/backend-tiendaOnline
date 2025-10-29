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

        const total = items.reduce((acc, x) => acc + Number(x.total || 0), 0);
        res.json({ cart, items, total });
        } catch (e) {
        console.error('Cart.getOrCreate', e);
        res.status(500).json({ message: 'Failed to get cart' });
        }
    },

    // Agrega o actualiza un item (acumula cantidad si ya existe)
    async addItem(req, res) {
        try {
        const userId = req.user.id;
        const { producto_id, cantidad = 1 } = req.body || {};
        if (!producto_id || Number(cantidad) <= 0) {
            return res.status(400).json({ message: 'producto_id and cantidad > 0 are required' });
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
        if (!prodRows.length) return res.status(404).json({ message: 'Product not found' });

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
        res.status(500).json({ message: 'Failed to add item' });
        }
    },

    // Cambia cantidad
    async updateItem(req, res) {
        try {
        const userId = req.user.id;
        const itemId = Number(req.params.itemId);
        const { cantidad } = req.body || {};
        if (!itemId || Number(cantidad) <= 0) {
            return res.status(400).json({ message: 'cantidad > 0 is required' });
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
        res.status(500).json({ message: 'Failed to update item' });
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
        if (del.affectedRows === 0) return res.status(404).json({ message: 'Item not found' });

        return CartController.getOrCreate(req, res);
        } catch (e) {
        console.error('Cart.removeItem', e);
        res.status(500).json({ message: 'Failed to remove item' });
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
        res.status(500).json({ message: 'Failed to clear cart' });
        }
    },

    // Checkout simple: marca el carrito y devuelve id (luego lo ligamos a "pedido")
    async checkout(req, res) {
        try {
        const userId = req.user.id;
        const [cartRows] = await pool.query(
            `SELECT id FROM carrito WHERE usuario_id = ? AND estado = 'ABIERTO' LIMIT 1`,
            [userId]
        );
        if (!cartRows.length) return res.status(400).json({ message: 'No open cart' });

        const cartId = cartRows[0].id;

        // valida que tenga items
        const [cnt] = await pool.query(`SELECT COUNT(*) as n FROM item_carrito WHERE carrito_id = ?`, [cartId]);
        if (!cnt[0].n) return res.status(400).json({ message: 'Cart is empty' });

        await pool.query(`UPDATE carrito SET estado = 'PEDIDO' WHERE id = ?`, [cartId]);
        res.json({ ok: true, cart_id: cartId });
        } catch (e) {
        console.error('Cart.checkout', e);
        res.status(500).json({ message: 'Failed to checkout' });
        }
    }
};
