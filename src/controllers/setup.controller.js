import { pool } from '../config/db.js';
import { hashPassword } from '../utils/hash.js';

/**
 * Endpoint de configuración inicial
 * - Crea roles si no existen
 * - Crea usuario ADMIN si no existe
 */
export async function setupAdmin(req, res) {
    try {
        const roles = ['ADMIN', 'CLIENTE', 'REPARTIDOR'];
        for (const r of roles) {
            await pool.query( 'INSERT IGNORE INTO rol (nombre, created_at, updated_at) VALUES (?, NOW(), NOW())', [r] );
        }

        const [users] = await pool.query('SELECT id FROM usuario WHERE correo = ? LIMIT 1', ['admin@tienda.com']);

        if (users.length) {
            return res.status(200).json({message: 'El usuario admin@tienda.com ya existe'});
        }

        const correo          = 'admin@tienda.com';
        const contrasena      = 'admin123';
        const nombre_completo = 'Administrador General';
        const telefono        = '0999999999';
        const hash            = hashPassword(contrasena);

        const [[rol]] = await pool.query('SELECT id FROM rol WHERE nombre = "ADMIN" LIMIT 1');

        await pool.query(
            `INSERT INTO usuario (correo, contrasena_hash, nombre_completo, telefono, rol_id)
            VALUES (?, ?, ?, ?, ?)`,
            [correo, hash, nombre_completo, telefono, rol.id]
        );

        res.status(201).json({
            message: 'Usuario ADMIN creado correctamente',
            correo,
            contrasena,
            nota: 'Por seguridad, cambia la contraseña después del primer inicio de sesión.'
        });
    } catch (e) {
        console.error('Error creando admin:', e);
        res.status(500).json({ message: 'Error en setup', error: e.message });
    }
}
