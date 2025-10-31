import { pool } from '../config/db.js';
import { hashPassword, verifyPassword } from '../utils/hash.js';
import { signAccessToken } from '../utils/jwt.js';

export const AuthController = {
    async login(req, res) {
        const { correo, password } = req.body || {};
        if (!correo || !password) return res.status(400).json({ message: 'Datos incompletos' });

        const [rows] = await pool.query(
            `SELECT u.id, u.nombre_completo, u.correo, u.telefono, u.estado, u.rol_id,
                    u.contrasena_hash,
                    r.nombre AS rol
            FROM usuario u
            JOIN rol r ON r.id = u.rol_id
            WHERE u.correo = ? AND u.estado = 'ACTIVE'
            LIMIT 1`,
            [correo]
        );
        if (!rows.length) return res.status(401).json({ message: 'Credenciales inválidas' });

        const row = rows[0];
        const ok = await verifyPassword(password, row.contrasena_hash);
        if (!ok) return res.status(401).json({ message: 'Credenciales inválidas' });

        // Usuario tal cual BD (sin contrasena_hash)
        const user = {
            id: row.id,
            nombre_completo: row.nombre_completo,
            correo: row.correo,
            rol_id: row.rol_id,
            rol: row.rol
        };

        const accessToken = signAccessToken({
            id: user.id,
            correo: user.correo,
            rol: user.rol,
            nombre_completo: user.nombre_completo
        });

        return res.json({ accessToken, user });
    },

    async me(req, res) {
        const userJwt = req.user;
        const [rows] = await pool.query(
            `SELECT u.id, u.nombre_completo, u.correo, u.telefono, u.estado, u.rol_id,
                    r.nombre AS rol,u.avatar_url
            FROM usuario u
            JOIN rol r ON r.id = u.rol_id
            WHERE u.id = ? LIMIT 1`,
            [userJwt.id]
        );
        if (!rows.length) return res.status(404).json({ message: 'Usuario no encontrado' });

        
        const base = (process.env.PUBLIC_URL || '').replace(/\/+$/,''); 
        const data = rows.map(r => {
        let url = r.avatar_url;
            if (url) url = `${base}${url}`;
            return { ...r, avatar_url: url };
        });

        return res.json(data[0]); // snake_case tal cual
    },

    async logout(_req, res) {
        // Stateless: el frontend elimina el token
        return res.json({ message: 'OK' });
    },

    async register(req, res) {
        const {
            correo,
            contrasena,
            nombre_completo,
            telefono = null,
            direccion 
        } = req.body || {};

        if (!correo || !contrasena || !nombre_completo) {
        return res.status(400).json({ message: 'correo, contrasena y nombre_completo son obligatorios' });
        }

        // correo único
        const [dup] = await pool.query(`SELECT 1 FROM usuario WHERE correo = ? LIMIT 1`, [correo]);
        if (dup.length) return res.status(409).json({ message: 'El correo ya está registrado' });

        const hash = await hashPassword(contrasena);
        const conn = await pool.getConnection();
        try {
            const ROLE_NAME = 'CLIENTE';
            // buscar rol por nombre (case-insensitive)
            const [rolRows] = await conn.query(
                `SELECT id FROM rol WHERE UPPER(nombre) = UPPER(?) LIMIT 1`,[ROLE_NAME]
            );

            if (!rolRows.length) {
                return res.status(500).json({
                    message: `No se encontró el rol "${ROLE_NAME}". Crea el rol o ajusta el nombre.`
                });
            }

            await conn.beginTransaction();
            const rolIdPorDefecto = rolRows[0].id;
            const [insUser] = await conn.query(
                `INSERT INTO usuario (correo, contrasena_hash, nombre_completo, telefono, estado, rol_id)
                VALUES (?, ?, ?, ?, 'ACTIVE', ?)`,
                [correo, hash, nombre_completo, telefono, rolIdPorDefecto]
            );
            const userId = insUser.insertId;

            if (direccion) {
                const {
                    tipo,
                    destinatario,
                    linea1,
                    linea2 = null,
                    ciudad,
                    provincia,
                    codigo_postal = null,
                    pais_codigo,
                    telefono: telDir = null,
                    es_predeterminada = true
                } = direccion;

                if (!tipo || !destinatario || !linea1 || !ciudad || !provincia || !pais_codigo) {
                await conn.rollback();
                return res.status(422).json({ message: 'Dirección incompleta' });
                }

                if (es_predeterminada) {
                await conn.query(
                        `UPDATE direccion
                        SET es_predeterminada = 0, updated_at = CURRENT_TIMESTAMP
                        WHERE usuario_id = ? AND tipo = ? AND es_predeterminada = 1`,
                        [userId, tipo]
                    );
                }

                await conn.query(
                    `INSERT INTO direccion
                    (usuario_id, tipo, destinatario, linea1, linea2, ciudad, provincia,
                        codigo_postal, pais_codigo, telefono, es_predeterminada)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [userId, tipo, destinatario, linea1, linea2, ciudad, provincia,
                    codigo_postal, pais_codigo, telDir, es_predeterminada ? 1 : 0]
                );
            }

            await conn.commit();

            const [rows] = await pool.query(
                `SELECT u.id, u.nombre_completo, u.correo, u.telefono, u.estado, u.rol_id, r.nombre AS rol
                FROM usuario u JOIN rol r ON r.id = u.rol_id
                WHERE u.id = ? LIMIT 1`,
                [userId]
            );
            const user = rows[0];

            const accessToken = signAccessToken({
                id: user.id,
                correo: user.correo,
                rol: user.rol,
                nombre_completo: user.nombre_completo
            });

            return res.status(201).json({ accessToken, user });
        } catch (e) {
            await conn.rollback();
            console.error(e);
            return res.status(500).json({ message: 'Error registrando usuario' });
        } finally {
            conn.release();
        }
    }

};
