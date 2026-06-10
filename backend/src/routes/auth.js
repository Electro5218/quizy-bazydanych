const express = require('express');
const jwt = require('jsonwebtoken');
const { Resend } = require('resend');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const resend = new Resend(process.env.RESEND_API_KEY);

const router = express.Router();

// ============================================================
// POST /api/auth/register
// Hasło hashowane przez pgcrypto (blowfish) w bazie danych.
// ============================================================
router.post('/register', async (req, res) => {
  const { email, username, first_name, last_name, password, role } = req.body;

  if (!email || !username || !password) {
    return res.status(400).json({ error: 'Email, username i haslo sa wymagane' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Haslo musi miec minimum 8 znakow' });
  }

  const allowedRoles = ['student', 'instructor'];
  const userRole = allowedRoles.includes(role) ? role : 'student';

  try {
    // hash_password() to funkcja bazy danych (pgcrypto blowfish)
    const result = await pool.query(
      `INSERT INTO users (email, username, first_name, last_name, password_hash, role)
       VALUES ($1, $2, $3, $4, hash_password($5), $6)
       RETURNING id, email, username, first_name, last_name, role, created_at`,
      [email.toLowerCase(), username, first_name || null, last_name || null, password, userRole]
    );

    const user = result.rows[0];

    await pool.query(
      `INSERT INTO email_verification_tokens (user_id)
       VALUES ($1)`,
      [user.id]
    );

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.status(201).json({
      message: 'Konto utworzone pomyslnie',
      token,
      user: { id: user.id, email: user.email, username: user.username, role: user.role }
    });
  } catch (err) {
    if (err.code === '23505') {
      const field = err.detail?.includes('email') ? 'email' : 'username';
      return res.status(409).json({ error: `Ten ${field} jest juz zajety` });
    }
    console.error('Blad rejestracji:', err);
    res.status(500).json({ error: 'Blad serwera' });
  }
});

// ============================================================
// POST /api/auth/login
// Weryfikacja hasła przez verify_password() w bazie danych.
// Blokada konta po 5 nieudanych próbach (15 min) - sprawdzana w DB.
// ============================================================
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email i haslo sa wymagane' });
  }

  try {
    const result = await pool.query(
      `SELECT id, email, username, password_hash, role, is_deleted, is_blocked
       FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: 'Nieprawidlowy email lub haslo' });
    }

    const user = result.rows[0];

    if (user.is_deleted) {
      return res.status(401).json({ error: 'Nieprawidlowy email lub haslo' });
    }
    if (user.is_blocked) {
      return res.status(403).json({ error: 'Konto jest zablokowane przez administratora' });
    }

    // Sprawdź blokadę czasową przez widok v_login_activity
    const lockCheck = await pool.query(
      `SELECT locked_until FROM login_attempts
       WHERE user_id = $1 AND locked_until > NOW()
       ORDER BY locked_until DESC LIMIT 1`,
      [user.id]
    );
    if (lockCheck.rows.length) {
      return res.status(429).json({
        error: 'Konto tymczasowo zablokowane po nieudanych probach logowania',
        locked_until: lockCheck.rows[0].locked_until
      });
    }

    // Weryfikacja hasła przez funkcję bazy danych
    const verifyResult = await pool.query(
      `SELECT verify_password($1, $2) AS ok`,
      [password, user.password_hash]
    );
    const passwordValid = verifyResult.rows[0].ok;

    if (!passwordValid) {
      // Zlicz nieudane próby przez bazę danych
      const failResult = await pool.query(
        `SELECT COUNT(*) AS cnt FROM login_attempts
         WHERE user_id = $1 AND success = false
           AND attempted_at > NOW() - INTERVAL '15 minutes'`,
        [user.id]
      );
      const fails = parseInt(failResult.rows[0].cnt) + 1;
      const lockedUntil = fails >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;

      await pool.query(
        `INSERT INTO login_attempts (user_id, success, locked_until) VALUES ($1, false, $2)`,
        [user.id, lockedUntil]
      );

      if (fails >= 5) {
        return res.status(429).json({
          error: 'Zbyt wiele nieudanych prob. Konto zablokowane na 15 minut.'
        });
      }
      return res.status(401).json({ error: 'Nieprawidlowy email lub haslo' });
    }

    // Udane logowanie
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
    console.error('Blad logowania:', err);
    res.status(500).json({ error: 'Blad serwera' });
  }
});

// ============================================================
// GET /api/auth/me
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
    res.status(500).json({ error: 'Blad serwera' });
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

    if (!result.rows.length) {
      return res.json({ message: 'Jesli email istnieje, wyslalismy link resetu' });
    }

    const userId = result.rows[0].id;

    await pool.query(
      `UPDATE password_reset_tokens SET is_used = true WHERE user_id = $1 AND is_used = false`,
      [userId]
    );

    const tokenResult = await pool.query(
      `INSERT INTO password_reset_tokens (user_id)
       VALUES ($1)
       RETURNING token`,
      [userId]
    );

    const resetToken = tokenResult.rows[0].token;
    const resetLink = `${process.env.FRONTEND_URL}/reset?token=${resetToken}`;

    const { data, error: sendError } = await resend.emails.send({
      from: process.env.RESEND_FROM,
      to: email,
      subject: 'Reset hasła – QuizyDB',
      html: `
        <p>Otrzymaliśmy prośbę o reset hasła dla Twojego konta.</p>
        <p>Kliknij poniższy link, aby ustawić nowe hasło (ważny 1 godzinę):</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>Jeśli to nie Ty wysłałeś tę prośbę, zignoruj tę wiadomość.</p>
      `
    });
    if (sendError) {
      console.error('[Resend] Błąd wysyłania:', sendError);
    } else {
      console.log('[Resend] Email wysłany, id:', data.id);
    }

    res.json({ message: 'Jesli email istnieje, wyslalismy link resetu' });
  } catch (err) {
    console.error('Blad resetu hasla:', err);
    res.status(500).json({ error: 'Blad serwera' });
  }
});

// ============================================================
// POST /api/auth/reset-password
// Nowe hasło hashowane przez hash_password() w bazie danych.
// Trigger trg_users_updated_at automatycznie aktualizuje updated_at.
// ============================================================
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Token i haslo sa wymagane' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Haslo musi miec minimum 8 znakow' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token = $1 AND is_used = false AND expires_at > NOW()`,
      [token]
    );

    if (!result.rows.length) {
      return res.status(400).json({ error: 'Token jest niewazny lub wygasl' });
    }

    const { id: tokenId, user_id: userId } = result.rows[0];

    await client.query('BEGIN');
    // hash_password() w bazie, trigger aktualizuje updated_at
    await client.query(
      `UPDATE users SET password_hash = hash_password($1) WHERE id = $2`,
      [password, userId]
    );
    await client.query(
      `UPDATE password_reset_tokens SET is_used = true WHERE id = $1`,
      [tokenId]
    );
    await client.query('COMMIT');

    res.json({ message: 'Haslo zostalo zmienione pomyslnie' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Blad resetowania hasla:', err);
    res.status(500).json({ error: 'Blad serwera' });
  } finally {
    client.release();
  }
});

module.exports = router;
