const express = require('express');
const pool = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// GET /api/pools  - lista pul pytań instruktora
// Używa widoku v_question_pool_stats.
// ============================================================
router.get('/', authenticate, requireRole('instructor', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT qp.id, qp.name, qp.description, qp.created_at,
              COUNT(pq.question_id)::int AS question_count,
              COUNT(DISTINCT q.id)::int AS used_in_quizzes_count
       FROM question_pools qp
       LEFT JOIN pool_questions pq ON pq.pool_id = qp.id
       LEFT JOIN quizzes q ON q.question_pool_id = qp.id
       WHERE qp.created_by = $1
       GROUP BY qp.id, qp.name, qp.description, qp.created_at
       ORDER BY qp.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Blad serwera' });
  }
});

// ============================================================
// POST /api/pools  - utwórz pulę pytań
// ============================================================
router.post('/', authenticate, requireRole('instructor', 'admin'), async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Nazwa puli jest wymagana' });

  try {
    const result = await pool.query(
      `INSERT INTO question_pools (name, description, created_by)
       VALUES ($1, $2, $3) RETURNING *`,
      [name, description || null, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Blad serwera' });
  }
});

// ============================================================
// GET /api/pools/:id  - szczegóły puli z pytaniami i statystykami
// ============================================================
router.get('/:id', authenticate, requireRole('instructor', 'admin'), async (req, res) => {
  const poolId = parseInt(req.params.id);

  try {
    const poolData = await pool.query(
      `SELECT qp.*, COUNT(pq.question_id)::int AS question_count
       FROM question_pools qp
       LEFT JOIN pool_questions pq ON pq.pool_id = qp.id
       WHERE qp.id = $1 AND qp.created_by = $2
       GROUP BY qp.id`,
      [poolId, req.user.id]
    );

    if (!poolData.rows.length) return res.status(404).json({ error: 'Pula nie istnieje' });

    // Pytania z widoku v_question_pool_stats
    const questions = await pool.query(
      `SELECT vqs.question_id AS id, vqs.content, vqs.question_type,
              vqs.is_public, vqs.used_in_quizzes, vqs.times_answered,
              vqs.answer_count, vqs.created_at,
              json_agg(
                json_build_object('id', ao.id, 'content', ao.content, 'is_correct', ao.is_correct)
                ORDER BY ao.id
              ) AS answers
       FROM v_question_pool_stats vqs
       JOIN pool_questions pq ON pq.question_id = vqs.question_id
       LEFT JOIN answer_options ao ON ao.question_id = vqs.question_id
       WHERE pq.pool_id = $1
       GROUP BY vqs.question_id, vqs.content, vqs.question_type, vqs.is_public,
                vqs.used_in_quizzes, vqs.times_answered, vqs.answer_count, vqs.created_at,
                pq.added_at
       ORDER BY pq.added_at`,
      [poolId]
    );

    res.json({ ...poolData.rows[0], questions: questions.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Blad serwera' });
  }
});

// ============================================================
// PUT /api/pools/:id  - zmień nazwę/opis puli
// ============================================================
router.put('/:id', authenticate, requireRole('instructor', 'admin'), async (req, res) => {
  const poolId = parseInt(req.params.id);
  const { name, description } = req.body;

  try {
    const check = await pool.query(
      'SELECT id FROM question_pools WHERE id = $1 AND created_by = $2',
      [poolId, req.user.id]
    );
    if (!check.rows.length) return res.status(404).json({ error: 'Pula nie istnieje' });

    const result = await pool.query(
      `UPDATE question_pools
       SET name = COALESCE($1, name), description = $2
       WHERE id = $3 RETURNING *`,
      [name, description ?? null, poolId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Blad serwera' });
  }
});

// ============================================================
// POST /api/pools/:id/questions  - dodaj pytanie do puli
// ============================================================
router.post('/:id/questions', authenticate, requireRole('instructor', 'admin'), async (req, res) => {
  const poolId = parseInt(req.params.id);
  const { question_id } = req.body;

  if (!question_id) return res.status(400).json({ error: 'ID pytania jest wymagane' });

  try {
    const check = await pool.query(
      'SELECT id FROM question_pools WHERE id = $1 AND created_by = $2',
      [poolId, req.user.id]
    );
    if (!check.rows.length) return res.status(404).json({ error: 'Pula nie istnieje' });

    const qCheck = await pool.query(
      `SELECT id FROM question_bank WHERE id = $1 AND (created_by = $2 OR is_public = true)`,
      [question_id, req.user.id]
    );
    if (!qCheck.rows.length) return res.status(404).json({ error: 'Pytanie nie znalezione' });

    await pool.query(
      `INSERT INTO pool_questions (pool_id, question_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [poolId, question_id]
    );

    res.status(201).json({ message: 'Pytanie dodane do puli' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Blad serwera' });
  }
});

// ============================================================
// DELETE /api/pools/:id/questions/:questionId
// ============================================================
router.delete('/:id/questions/:questionId', authenticate, requireRole('instructor', 'admin'), async (req, res) => {
  const poolId = parseInt(req.params.id);
  const questionId = parseInt(req.params.questionId);

  try {
    const check = await pool.query(
      'SELECT id FROM question_pools WHERE id = $1 AND created_by = $2',
      [poolId, req.user.id]
    );
    if (!check.rows.length) return res.status(404).json({ error: 'Pula nie istnieje' });

    await pool.query(
      'DELETE FROM pool_questions WHERE pool_id = $1 AND question_id = $2',
      [poolId, questionId]
    );

    res.json({ message: 'Pytanie usuniete z puli' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Blad serwera' });
  }
});

// ============================================================
// POST /api/pools/:id/import  - zbiorczy import pytań do puli
// Body: { questions: [{ content, question_type, answers: [{content, is_correct}] }] }
// Tworzy pytania w question_bank i od razu dodaje do puli.
// ============================================================
router.post('/:id/import', authenticate, requireRole('instructor', 'admin'), async (req, res) => {
  const poolId = parseInt(req.params.id);
  const { questions } = req.body;

  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'Lista pytan jest wymagana' });
  }

  const client = await pool.connect();
  try {
    const check = await client.query(
      'SELECT id FROM question_pools WHERE id = $1 AND created_by = $2',
      [poolId, req.user.id]
    );
    if (!check.rows.length) return res.status(404).json({ error: 'Pula nie istnieje' });

    await client.query('BEGIN');

    let imported = 0;
    const errors = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.content?.trim()) { errors.push(`Pytanie ${i+1}: brak tresci`); continue; }
      if (!q.answers || q.answers.length < 2) { errors.push(`Pytanie ${i+1}: minimum 2 odpowiedzi`); continue; }
      if (!q.answers.some(a => a.is_correct)) { errors.push(`Pytanie ${i+1}: brak poprawnej odpowiedzi`); continue; }

      const type = q.question_type === 'multiple' ? 'multiple' : 'single';

      const qRes = await client.query(
        `INSERT INTO question_bank (created_by, content, question_type, is_public)
         VALUES ($1, $2, $3, false) RETURNING id`,
        [req.user.id, q.content.trim(), type]
      );
      const qid = qRes.rows[0].id;

      for (const a of q.answers) {
        await client.query(
          `INSERT INTO answer_options (question_id, content, is_correct) VALUES ($1, $2, $3)`,
          [qid, a.content.trim(), !!a.is_correct]
        );
      }

      await client.query(
        `INSERT INTO pool_questions (pool_id, question_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [poolId, qid]
      );
      imported++;
    }

    await client.query('COMMIT');
    res.json({ message: `Zaimportowano ${imported} pytan`, imported, errors });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Blad importu' });
  } finally {
    client.release();
  }
});

// ============================================================
// DELETE /api/pools/:id  - usuń pulę
// ============================================================
router.delete('/:id', authenticate, requireRole('instructor', 'admin'), async (req, res) => {
  const poolId = parseInt(req.params.id);

  try {
    const check = await pool.query(
      'SELECT id FROM question_pools WHERE id = $1 AND created_by = $2',
      [poolId, req.user.id]
    );
    if (!check.rows.length) return res.status(404).json({ error: 'Pula nie istnieje' });

    const inUse = await pool.query(
      'SELECT id FROM quizzes WHERE question_pool_id = $1 LIMIT 1',
      [poolId]
    );
    if (inUse.rows.length) {
      return res.status(409).json({ error: 'Nie mozna usunac puli uzywanej przez quiz' });
    }

    await pool.query('DELETE FROM question_pools WHERE id = $1', [poolId]);
    res.json({ message: 'Pula usunieta' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Blad serwera' });
  }
});

module.exports = router;
