// Da usare dopo authenticateToken: consente l'accesso solo ai superuser.
const requireSuperuser = (req, res, next) => {
    if (req.user?.role !== 'superuser') {
        return res.status(403).json({ error: 'Accesso riservato ai superuser' });
    }
    next();
};

module.exports = requireSuperuser;
