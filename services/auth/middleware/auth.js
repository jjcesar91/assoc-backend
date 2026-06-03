const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret', (err, user) => {
    if (err) return res.sendStatus(err.name === 'TokenExpiredError' ? 401 : 403);
    req.user = user;
    next();
  });
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'superuser') {
    return res.status(403).json({ error: 'Accesso riservato agli amministratori' });
  }
  next();
};

const requireSuperuser = (req, res, next) => {
  if (req.user?.role !== 'superuser') {
    return res.status(403).json({ error: 'Accesso riservato ai superuser' });
  }
  next();
};

module.exports = authenticateToken;
module.exports.requireAdmin = requireAdmin;
module.exports.requireSuperuser = requireSuperuser;
