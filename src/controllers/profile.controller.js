// src/controllers/profile.controller.js
import { pool } from '../config/db.js';
import { hashPassword, verifyPassword } from '../utils/hash.js';
import { urlFor, MOUNT_PATH } from '../config/multer.config.js';

function  resolveUploadBase() {
    const dir = process.env.UPLOAD_DIR || 'public/images';
    return path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
}

export const ProfileController = {
    async updateMe(req, res) {
        const userId = req.user.id;
        const { nombre_completo, telefono = null } = req.body || {};
        if (!nombre_completo || typeof telefono === 'undefined') {
        return res.status(400).json({ message: 'PUT requiere nombre_completo y telefono' });
        }

        await pool.query(
            `UPDATE usuario
            SET nombre_completo = ?, telefono = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
            [nombre_completo, telefono, userId]
        );

        const [rows] = await pool.query(
            `SELECT u.id, u.nombre_completo, u.correo, u.telefono, u.estado, u.rol_id, r.nombre AS rol
            FROM usuario u JOIN rol r ON r.id = u.rol_id
            WHERE u.id = ? LIMIT 1`,
            [userId]
        );
        res.json(rows[0]);
    },

    async changePassword(req, res) {
        const userId = req.user.id;
        const { contrasena_actual, contrasena_nueva } = req.body || {};
        if (!contrasena_actual || !contrasena_nueva) {
        return res.status(400).json({ message: 'Datos incompletos' });
        }

        const [rows] = await pool.query(
        `SELECT contrasena_hash FROM usuario WHERE id = ? LIMIT 1`,
        [userId]
        );
        if (!rows.length) return res.status(404).json({ message: 'No encontrado' });

        const ok = await verifyPassword(contrasena_actual, rows[0].contrasena_hash);
        if (!ok) return res.status(401).json({ message: 'Contraseña actual inválida' });

        const newHash = await hashPassword(contrasena_nueva);
        await pool.query(
        `UPDATE usuario SET contrasena_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [newHash,userId]
        );

        res.json({ message: 'Contraseña actualizada' });
    },

    async updateAvatar(req, res) {
        if (!req.file) return res.status(400).json({ message: 'Archivo requerido' });

        const userId = req.user.id;
        // 1) Guardar en BD URL RELATIVA coherente con /images
        const relUrl = urlFor('avatars', req.file.filename); // p.ej. /images/avatars/xxx.webp

        // avatar anterior (para borrar si era local)
        const [prevRows] = await pool.query(
        `SELECT avatar_url FROM usuario WHERE id = ? LIMIT 1`, [userId]
        );
        const prev = prevRows?.[0]?.avatar_url || null;

        await pool.query(
        `UPDATE usuario SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [relUrl, userId]
        );

        // 2) Responder usuario actualizado con URL ABSOLUTA (para Ionic)
        const [urows] = await pool.query(
            `SELECT u.id, u.nombre_completo, u.correo, u.telefono, u.estado, u.rol_id, u.avatar_url, r.nombre AS rol
            FROM usuario u JOIN rol r ON r.id = u.rol_id
            WHERE u.id = ? LIMIT 1`,
            [userId]
        );
        const user = urows[0];

        const base = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');
        const mount = MOUNT_PATH.replace(/\/+$/, '');
        if (user.avatar_url?.startsWith(mount)) {
            user.avatar_url = `${base}${user.avatar_url}`;
        }

        // 3) Borrar el archivo anterior si era local bajo MOUNT_PATH
        try {
            if (prev) {
                const re = new RegExp(`^${mount.replace('/', '\\/')}/?`); // ^/images/
                if (re.test(prev)) {
                const rel = prev.replace(re, '');                // avatars/old.png
                const abs = path.join(resolveUploadBase(), rel); // .../public/images/avatars/old.png
                fs.unlink(abs, () => {});
                }
            }
        } catch { 
        }

        return res.json(user);
    }
};
