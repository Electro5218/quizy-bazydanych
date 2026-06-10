const express = require('express');
const pool = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// GET /api/questions  - bank pytań instruktora
// ============================================================
router.get('/', authenticate, requireRole('instructor', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT qb.*, u.username as created_by_username,
              COUNT(ao.id) as answer_count
       FROM question_bank qb
       JOIN users u ON qb.created_by = u.id
       LEFT JOIN answer_options ao ON qb.id = ao.question_id
       WHERE qb.created_by = $1 OR qb.is_public = true
       GROUP BY qb.id, u.username
       ORDER BY qb.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ============================================================
// POST /api/questions  - utwórz pytanie z odpowiedziami
// ============================================================
router.post('/', authenticate, requireRole('instructor', 'admin'), async (req, res) => {
  const { content, latex_content, question_type, is_public, answers } = req.body;

  if (!content) return res.status(400).json({ error: 'Treść pytania jest wymagana' });
  if (!answers || !Array.isArray(answers) || answers.length < 2) {
    return res.status(400).json({ error: 'Pytanie musi mieć co najmniej 2 odpowiedzi' });
  }

  const type = ['single', 'multiple'].includes(question_type) ? question_type : 'single';

  // Sprawdź czy jest przynajmniej 1 poprawna odpowiedź
  const hasCorrect = answers.some(a => a.is_correct);
  if (!hasCorrect) {
    return res.status(400).json({ error: 'Pytanie musi mieć co najmniej 1 poprawną odpowiedź' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const question = await client.query(
      `INSERT INTO question_bank (created_by, content, latex_content, question_type, is_public)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.id, content, latex_content || null, type, is_public || false]
    );

    const questionId = question.rows[0].id;

    // Wstaw odpowiedzi
    for (const answer of answers) {
      await client.query(
        `INSERT INTO answer_options (question_id, content, latex_content, is_correct)
         VALUES ($1, $2, $3, $4)`,
        [questionId, answer.content, answer.latex_content || null, answer.is_correct || false]
      );
    }

    await client.query('COMMIT');

    // Pobierz pełne pytanie z odpowiedziami
    const full = await pool.query(
      `SELECT qb.*, json_agg(ao ORDER BY ao.id) as answers
       FROM question_bank qb
       LEFT JOIN answer_options ao ON qb.id = ao.question_id
       WHERE qb.id = $1
       GROUP BY qb.id`,
      [questionId]
    );

    res.status(201).json(full.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  } finally {
    client.release();
  }
});

// ============================================================
// GET /api/questions/:id  - szczegóły pytania
// ============================================================
router.get('/:id', authenticate, requireRole('instructor', 'admin'), async (req, res) => {
  const questionId = parseInt(req.params.id);

  try {
    const result = await pool.query(
      `SELECT qb.*, json_agg(ao ORDER BY ao.id) as answers
       FROM question_bank qb
       LEFT JOIN answer_options ao ON qb.id = ao.question_id
       WHERE qb.id = $1 AND (qb.created_by = $2 OR qb.is_public = true)
       GROUP BY qb.id`,
      [questionId, req.user.id]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Pytanie nie istnieje' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ============================================================
// PUT /api/questions/:id  - edytuj pytanie
// ============================================================
router.put('/:id', authenticate, requireRole('instructor', 'admin'), async (req, res) => {
  const questionId = parseInt(req.params.id);
  const { content, latex_content, question_type, is_public, answers } = req.body;

  const client = await pool.connect();
  try {
    const question = await client.query(
      'SELECT created_by FROM question_bank WHERE id = $1',
      [questionId]
    );
    if (!question.rows.length) return res.status(404).json({ error: 'Pytanie nie istnieje' });
    if (question.rows[0].created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Brak uprawnień' });
    }

    await client.query('BEGIN');

    await client.query(
      `UPDATE question_bank SET
         content = COALESCE($1, content),
         latex_content = $2,
         question_type = COALESCE($3, question_type),
         is_public = COALESCE($4, is_public)
       WHERE id = $5`,
      [content, latex_content, question_type, is_public, questionId]
    );

    // Zastąp odpowiedzi jeśli podano
    if (answers && Array.isArray(answers)) {
      await client.query('DELETE FROM answer_options WHERE question_id = $1', [questionId]);
      for (const answer of answers) {
        await client.query(
          `INSERT INTO answer_options (question_id, content, latex_content, is_correct)
           VALUES ($1, $2, $3, $4)`,
          [questionId, answer.content, answer.latex_content || null, answer.is_correct || false]
        );
      }
    }

    await client.query('COMMIT');

    const full = await pool.query(
      `SELECT qb.*, json_agg(ao ORDER BY ao.id) as answers
       FROM question_bank qb
       LEFT JOIN answer_options ao ON qb.id = ao.question_id
       WHERE qb.id = $1 GROUP BY qb.id`,
      [questionId]
    );

    res.json(full.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  } finally {
    client.release();
  }
});

// ============================================================
// DELETE /api/questions/:id
// ============================================================
router.delete('/:id', authenticate, requireRole('instructor', 'admin'), async (req, res) => {
  const questionId = parseInt(req.params.id);

  try {
    const question = await pool.query(
      'SELECT created_by FROM question_bank WHERE id = $1',
      [questionId]
    );
    if (!question.rows.length) return res.status(404).json({ error: 'Pytanie nie istnieje' });
    if (question.rows[0].created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Brak uprawnień' });
    }

    await pool.query('DELETE FROM question_bank WHERE id = $1', [questionId]);
    res.json({ message: 'Pytanie usunięte' });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({ error: 'Nie można usunąć pytania używanego w quizie' });
    }
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;
