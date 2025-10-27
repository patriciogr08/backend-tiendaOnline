export function errorHandler(err, req, res, next) {
    if (process.env.NODE_ENV !== 'production') {
        console.error('[ERROR]', err);
    }
    const status = err.status || 500;
    res.status(status).json({
        message: err.message || 'Error interno del servidor'
    });
}
