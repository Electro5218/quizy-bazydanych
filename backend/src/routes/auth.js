const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// POST /api/auth/register
// ============================================================
router.post('/register', async (req, res) => {
  const { email, username, first_name, last_name, password, role } = req.body;

  if (!email || !username || !password) {
    return res.status(400).json({ error: 'Email, username i hasło są wymagane' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Hasło musi mieć minimum 8 znaków' });
  }

  // Tylko admin może tworzyć instruktora/admina
  const allowedRoles = ['student', 'instructor'];
  const userRole = allowedRoles.includes(role) ? role : 'student';

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (email, username, first_name, last_name, password_hash, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, username, first_name, last_name, role, created_at`,
      [email.toLowerCase(), username, first_name || null, last_name || null, passwordHash, userRole]
    );

    const user = result.rows[0];

    // Wygeneruj token weryfikacji email
    await pool.query(
      `INSERT INTO email_verification_tokens (user_id, token, expires_at)
       VALUES ($1, gen_random_uuid(), NOW() + INTERVAL '24 hours')`,
      [user.id]
    );

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.status(201).json({
      message: 'Konto utworzone pomyślnie',
      token,
      user: { id: user.id, email: user.email, username: user.username, role: user.role }
    });
  } catch (err) {
    if (err.code === '23505') {
      const field = err.detail.includes('email') ? 'email' : 'username';
      return res.status(409).json({ error: `Ten ${field} jest już zajęty` });
    }
    console.error('Błąd rejestracji:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ============================================================
// POST /api/auth/login
// ============================================================
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email i hasło są wymagane' });
  }

  try {
    const result = await pool.query(
      `SELECT id, email, username, password_hash, role, is_deleted, is_blocked
       FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: 'Nieprawidłowy email lub hasło' });
    }

    const user = result.rows[0];

    if (user.is_deleted) {
      return res.status(401).json({ error: 'Konto zostało usunięte' });
    }

    if (user.is_blocked) {
      return res.status(403).json({ error: 'Konto jest zablokowane przez administratora' });
    }

    // Sprawdź blokadę czasową
    const lockCheck = await pool.query(
      `SELECT locked_until FROM login_attempts
       WHERE user_id = $1 AND locked_until > NOW()
       ORDER BY locked_until DESC LIMIT 1`,
      [user.id]
    );

    if (lockCheck.rows.length) {
      const until = lockCheck.rows[0].locked_until;
      return res.status(429).json({
        error: 'Konto tymczasowo zablokowane po nieudanych próbach logowania',
        locked_until: until
      });
    }

    const passwordValid = await bcrypt.compare(password, user.password_hash);

    // Zapisz próbę logowania
    if (!passwordValid) {
      // Sprawdź ile nieudanych prób w ostatnich 15 minutach
      const failCount = await pool.query(
        `SELECT COUNT(*) FROM login_attempts
         WHERE user_id = $1 AND success = false AND attempted_at > NOW() - INTERVAL '15 minutes'`,
        [user.id]
      );

      const fails = parseInt(failCount.rows[0].count) + 1;
      let lockedUntil = null;

      if (fails >= 5) {
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minut blokady
      }

      await pool.query(
        `INSERT INTO login_attempts (user_id, success, locked_until) VALUES ($1, false, $2)`,
        [user.id, lockedUntil]
      );

      if (fails >= 5) {
        return res.status(429).json({
          error: 'Zbyt wiele nieudanych prób. Konto zablokowane na 15 minut.'
        });
      }

      return res.status(401).json({ error: 'Nieprawidłowy email lub hasło' });
    }

    // Udane logowanie - zapisz próbę
    await pool.query(
      `INSERT INTO login_attempts (user_id, success) VALUES ($1, true)`,
      [user.id]
    );

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, username: user.username, role: user.role }
    });
  } catch (err) {
    console.error('Błąd logowania:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ============================================================
// GET /api/auth/me  (profil zalogowanego)
// ============================================================
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, username, first_name, last_name, role, email_verified, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ============================================================
// POST /api/auth/forgot-password
// ============================================================
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email jest wymagany' });

  try {
    const result = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND is_deleted = false',
      [email.toLowerCase()]
    );

    // Zawsze zwracaj sukces (bezpieczeństwo - nie ujawniaj czy email istnieje)
    if (!result.rows.length) {
      return res.json({ message: 'Jeśli email istnieje, wysłaliśmy link resetu' });
    }

    const userId = result.rows[0].id;

    // Zdezaktywuj stare tokeny
    await pool.query(
      `UPDATE password_reset_tokens SET is_used = true WHERE user_id = $1 AND is_used = false`,
      [userId]
    );

    const tokenResult = await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at)
       VALUES ($1, gen_random_uuid(), NOW() + INTERVAL '15 minutes')
       RETURNING token`,
      [userId]
    );

    const resetToken = tokenResult.rows[0].token;
    // TODO: Wyślij email z linkiem: ${process.env.FRONTEND_URL}/reset-password?token=${resetToken}
    console.log(`[DEV] Token resetu dla ${email}: ${resetToken}`);

    res.json({ message: 'Jeśli email istnieje, wysłaliśmy link resetu' });
  } catch (err) {
    console.error('Błąd resetu hasła:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ============================================================
// POST /api/auth/reset-password
// ============================================================
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Token i hasło są wymagane' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Hasło musi mieć minimum 8 znaków' });
  }

  try {
    const result = await pool.query(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token = $1 AND is_used = false AND expires_at > NOW()`,
      [token]
    );

    if (!result.rows.length) {
      return res.status(400).json({ error: 'Token jest nieważny lub wygasł' });
    }

    const { id: tokenId, user_id: userId } = result.rows[0];
    const passwordHash = await bcrypt.hash(password, 12);

    await pool.query('BEGIN');
    await pool.query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [passwordHash, userId]
    );
    await pool.query(
      `UPDATE password_reset_tokens SET is_used = true WHERE id = $1`,
      [tokenId]
    );
    await pool.query('COMMIT');

    res.json({ message: 'Hasło zostało zmienione pomyślnie' });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Błąd resetowania hasła:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;
