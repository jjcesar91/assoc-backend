// Protegge gli endpoint interni (chiamate service-to-service sulla rete docker).
// Richiede l'header x-internal-secret uguale a INTERNAL_API_SECRET.
module.exports = function requireInternal(req, res, next) {
    const expected = process.env.INTERNAL_API_SECRET || 'internal_secret_change_me';
    const provided = req.headers['x-internal-secret'];
    if (!provided || provided !== expected) {
        return res.status(403).json({ error: 'Accesso interno non autorizzato' });
    }
    next();
};
