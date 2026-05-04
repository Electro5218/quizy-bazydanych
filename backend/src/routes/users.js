const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// GET /api/users  - lista użytkowników (admin only)
// ============================================================
router.get('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, username, first_name, last_name, role,
              email_verified, is_deleted, is_blocked, created_at
       FROM users ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ============================================================
// GET /api/users/:id  - profil użytkownika
// ============================================================
router.get('/:id', authenticate, async (req, res) => {
  const userId = parseInt(req.params.id);

  // Student może zobaczyć tylko swój profil
  if (req.user.role === 'student' && req.user.id !== userId) {
    return res.status(403).json({ error: 'Brak dostępu' });
  }

  try {
    const result = await pool.query(
      `SELECT id, email, username, first_name, last_name, role,
              email_verified, created_at
       FROM users WHERE id = $1 AND is_deleted = false`,
      [userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Użytkownik nie istnieje' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ============================================================
// PUT /api/users/:id  - edytuj profil
// ============================================================
router.put('/:id', authenticate, async (req, res) => {
  const userId = parseInt(req.params.id);

  if (req.user.role === 'student' && req.user.id !== userId) {
    return res.status(403).json({ error: 'Brak dostępu' });
  }

  const { first_name, last_name, username } = req.body;

  try {
    const result = await pool.query(
      `UPDATE users SET
         first_name = COALESCE($1, first_name),
         last_name = COALESCE($2, last_name),
         username = COALESCE($3, username),
         updated_at = NOW()
       WHERE id = $4 AND is_deleted = false
       RETURNING id, email, username, first_name, last_name, role`,
      [first_name, last_name, username, userId]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Użytkownik nie istnieje' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ta nazwa użytkownika jest już zajęta' });
    }
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ============================================================
// PUT /api/users/:id/password  - zmiana hasła
// ============================================================
router.put('/:id/password', authenticate, async (req, res) => {
  const userId = parseInt(req.params.id);

  if (req.user.id !== userId) {
    return res.status(403).json({ error: 'Możesz zmienić tylko własne hasło' });
  }

  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Aktualne i nowe hasło są wymagane' });
  }
  if (new_password.length < 8) {
    return res.status(400).json({ error: 'Nowe hasło musi mieć minimum 8 znaków' });
  }

  try {
    const user = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    const valid = await bcrypt.compare(current_password, user.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Nieprawidłowe aktualne hasło' });

    const hash = await bcrypt.hash(new_password, 12);
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [hash, userId]
    );

    res.json({ message: 'Hasło zmienione pomyślnie' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ============================================================
// DELETE /api/users/:id  - soft delete konta
// ============================================================
router.delete('/:id', authenticate, async (req, res) => {
  const userId = parseInt(req.params.id);

  if (req.user.role !== 'admin' && req.user.id !== userId) {
    return res.status(403).json({ error: 'Brak uprawnień' });
  }

  try {
    await pool.query(
      `UPDATE users SET is_deleted = true, updated_at = NOW() WHERE id = $1`,
      [userId]
    );
    res.json({ message: 'Konto zostało dezaktywowane' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ============================================================
// PATCH /api/users/:id/block  - blokada/odblokowanie (admin)
// ============================================================
router.patch('/:id/block', authenticate, requireRole('admin'), async (req, res) => {
  const userId = parseInt(req.params.id);
  const { is_blocked } = req.body;

  try {
    await pool.query(
      `UPDATE users SET is_blocked = $1, updated_at = NOW() WHERE id = $2`,
      [is_blocked, userId]
    );
    res.json({ message: is_blocked ? 'Konto zablokowane' : 'Konto odblokowane' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;
