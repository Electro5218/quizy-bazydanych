const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

// Weryfikacja tokenu JWT
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Brak tokenu autoryzacji' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Sprawdź czy użytkownik nadal istnieje i nie jest zablokowany
    const result = await pool.query(
      'SELECT id, email, username, role, is_deleted, is_blocked FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: 'Użytkownik nie istnieje' });
    }

    const user = result.rows[0];

    if (user.is_deleted) {
      return res.status(401).json({ error: 'Konto zostało usunięte' });
    }

    if (user.is_blocked) {
      return res.status(403).json({ error: 'Konto jest zablokowane' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token wygasł' });
    }
    return res.status(401).json({ error: 'Nieprawidłowy token' });
  }
};

// Wymagaj konkretnej roli
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      error: `Brak uprawnień. Wymagana rola: ${roles.join(' lub ')}`
    });
  }
  next();
};

module.exports = { authenticate, requireRole };
