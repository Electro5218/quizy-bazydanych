const express = require('express');
const pool = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// GET /api/groups  - lista grup użytkownika
// ============================================================
router.get('/', authenticate, async (req, res) => {
  try {
    let result;

    if (req.user.role === 'instructor' || req.user.role === 'admin') {
      // Instruktor widzi swoje grupy
      result = await pool.query(
        `SELECT g.*, u.username as instructor_username,
                COUNT(gu.user_id) FILTER (WHERE gu.status = 'accepted') as student_count
         FROM groups g
         JOIN users u ON g.instructor_id = u.id
         LEFT JOIN group_users gu ON g.id = gu.group_id
         WHERE g.instructor_id = $1
         GROUP BY g.id, u.username
         ORDER BY g.created_at DESC`,
        [req.user.id]
      );
    } else {
      // Student widzi grupy, do których należy
      result = await pool.query(
        `SELECT g.*, u.username as instructor_username, gu.status as my_status,
                COUNT(gu2.user_id) FILTER (WHERE gu2.status = 'accepted') as student_count
         FROM groups g
         JOIN users u ON g.instructor_id = u.id
         JOIN group_users gu ON g.id = gu.group_id AND gu.user_id = $1
         LEFT JOIN group_users gu2 ON g.id = gu2.group_id
         GROUP BY g.id, u.username, gu.status
         ORDER BY gu.joined_at DESC`,
        [req.user.id]
      );
    }

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ============================================================
// POST /api/groups  - utwórz grupę (instructor/admin)
// ============================================================
router.post('/', authenticate, requireRole('instructor', 'admin'), async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Nazwa grupy jest wymagana' });

  // Wygeneruj unikalny kod 8-znakowy
  const joinCode = Math.random().toString(36).substring(2, 10).toUpperCase();

  try {
    const result = await pool.query(
      `INSERT INTO groups (name, instructor_id, join_code)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, req.user.id, joinCode]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ============================================================
// GET /api/groups/:id  - szczegóły grupy
// ============================================================
router.get('/:id', authenticate, async (req, res) => {
  const groupId = parseInt(req.params.id);

  try {
    const group = await pool.query(
      `SELECT g.*, u.username as instructor_username, u.first_name, u.last_name
       FROM groups g JOIN users u ON g.instructor_id = u.id
       WHERE g.id = $1`,
      [groupId]
    );

    if (!group.rows.length) {
      return res.status(404).json({ error: 'Grupa nie istnieje' });
    }

    // Sprawdź dostęp
    const g = group.rows[0];
    if (req.user.role === 'student') {
      const membership = await pool.query(
        `SELECT status FROM group_users WHERE group_id = $1 AND user_id = $2`,
        [groupId, req.user.id]
      );
      if (!membership.rows.length) {
        return res.status(403).json({ error: 'Nie należysz do tej grupy' });
      }
    } else if (req.user.role === 'instructor' && g.instructor_id !== req.user.id) {
      return res.status(403).json({ error: 'Brak dostępu do tej grupy' });
    }

    // Pobierz członków
    const members = await pool.query(
      `SELECT u.id, u.username, u.first_name, u.last_name, u.email, gu.status, gu.joined_at
       FROM group_users gu JOIN users u ON gu.user_id = u.id
       WHERE gu.group_id = $1
       ORDER BY gu.joined_at`,
      [groupId]
    );

    res.json({ ...g, members: members.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ============================================================
// POST /api/groups/join  - dołącz do grupy przez kod
// ============================================================
router.post('/join', authenticate, requireRole('student'), async (req, res) => {
  const { join_code } = req.body;
  if (!join_code) return res.status(400).json({ error: 'Kod dołączenia jest wymagany' });

  try {
    const group = await pool.query(
      'SELECT id, name FROM groups WHERE join_code = $1',
      [join_code.toUpperCase()]
    );

    if (!group.rows.length) {
      return res.status(404).json({ error: 'Nieprawidłowy kod grupy' });
    }

    const groupId = group.rows[0].id;

    // Sprawdź czy już należy
    const existing = await pool.query(
      'SELECT status FROM group_users WHERE group_id = $1 AND user_id = $2',
      [groupId, req.user.id]
    );

    if (existing.rows.length) {
      return res.status(409).json({
        error: `Już jesteś w tej grupie (status: ${existing.rows[0].status})`
      });
    }

    await pool.query(
      `INSERT INTO group_users (group_id, user_id, status) VALUES ($1, $2, 'pending')`,
      [groupId, req.user.id]
    );

    res.status(201).json({
      message: 'Prośba o dołączenie wysłana, oczekuj akceptacji instruktora',
      group: group.rows[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ============================================================
// PATCH /api/groups/:id/members/:userId  - akceptuj/odrzuć
// ============================================================
router.patch('/:id/members/:userId', authenticate, requireRole('instructor', 'admin'), async (req, res) => {
  const groupId = parseInt(req.params.id);
  const targetUserId = parseInt(req.params.userId);
  const { status } = req.body; // 'accepted' or 'pending'

  if (!['accepted', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Status musi być: accepted lub pending' });
  }

  try {
    // Sprawdź własność grupy
    const group = await pool.query(
      'SELECT instructor_id FROM groups WHERE id = $1',
      [groupId]
    );
    if (!group.rows.length) return res.status(404).json({ error: 'Grupa nie istnieje' });
    if (group.rows[0].instructor_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Brak uprawnień' });
    }

    const result = await pool.query(
      `UPDATE group_users SET status = $1
       WHERE group_id = $2 AND user_id = $3
       RETURNING *`,
      [status, groupId, targetUserId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Członek nie znaleziony' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ============================================================
// DELETE /api/groups/:id/members/:userId  - usuń z grupy
// ============================================================
router.delete('/:id/members/:userId', authenticate, requireRole('instructor', 'admin'), async (req, res) => {
  const groupId = parseInt(req.params.id);
  const targetUserId = parseInt(req.params.userId);

  try {
    const group = await pool.query('SELECT instructor_id FROM groups WHERE id = $1', [groupId]);
    if (!group.rows.length) return res.status(404).json({ error: 'Grupa nie istnieje' });
    if (group.rows[0].instructor_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Brak uprawnień' });
    }

    await pool.query(
      'DELETE FROM group_users WHERE group_id = $1 AND user_id = $2',
      [groupId, targetUserId]
    );

    res.json({ message: 'Użytkownik usunięty z grupy' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;
