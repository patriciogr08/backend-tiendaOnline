/**
 * validate(schema)
 * - Valida req.body con Joi (schema).
 * - Si falla, responde 400 con el mensaje de Joi.
 */
export function validate(schema) {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, { abortEarly: true, stripUnknown: true });
        if (error) return res.status(400).json({ message: error.message });
        req.body = value;
        next();
    };
}
