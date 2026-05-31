const express = require('express');
const pool = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// GET /api/quizzes
// Instruktorzy: widok v_quiz_statistics (statystyki z bazy).
// Studenci: quizy z zaakceptowanych grup, w oknie czasowym.
// ============================================================
router.get('/', authenticate, async (req, res) => {
  try {
    let result;

    if (req.user.role === 'instructor' || req.user.role === 'admin') {
      result = await pool.query(
        `SELECT qs.*, qs.quiz_id AS id
         FROM v_quiz_statistics qs
         WHERE qs.created_by = $1
         ORDER BY qs.created_at DESC`,
        [req.user.id]
      );
    } else {
      result = await pool.query(
        `SELECT qs.*, qs.quiz_id AS id,
                COUNT(DISTINCT qa.id) FILTER (WHERE qa.user_id = $1) AS my_attempts
         FROM v_quiz_statistics qs
         JOIN groups g ON qs.group_id = g.id
         JOIN group_users gu ON g.id = gu.group_id AND gu.user_id = $1 AND gu.status = 'accepted'
         LEFT JOIN quiz_attempts qa ON qs.quiz_id = qa.quiz_id AND qa.user_id = $1
         WHERE qs.is_draft = false
           AND (qs.visible_from IS NULL OR qs.visible_from <= NOW())
           AND (qs.visible_until IS NULL OR qs.visible_until >= NOW())
         GROUP BY qs.quiz_id, qs.title, qs.group_id, qs.group_name, qs.created_by,
                  qs.max_attempts, qs.time_limit_sec, qs.is_draft, qs.question_pool_id,
                  qs.draw_count, qs.visible_from, qs.visible_until, qs.created_at, qs.updated_at,
                  qs.question_count, qs.attempt_count, qs.student_count,
                  qs.avg_score, qs.max_score, qs.min_score
         ORDER BY qs.created_at DESC`,
        [req.user.id]
      );
    }

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Blad serwera' });
  }
});

// ============================================================
// POST /api/quizzes  - utwórz quiz
// Obsługuje zarówno quiz z ręcznymi pytaniami jak i z pulą.
// ============================================================
router.post('/', authenticate, requireRole('instructor', 'admin'), async (req, res) => {
  const {
    title, group_id, time_limit_sec, max_attempts,
    visible_from, visible_until, question_pool_id, draw_count, is_draft
  } = req.body;

  if (!title) return res.status(400).json({ error: 'Tytul quizu jest wymagany' });

  try {
    if (group_id) {
      const group = await pool.query(
        'SELECT instructor_id FROM groups WHERE id = $1',
        [group_id]
      );
      if (!group.rows.length) return res.status(404).json({ error: 'Grupa nie istnieje' });
      if (group.rows[0].instructor_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Nie jestes wlascicielem tej grupy' });
      }
    }

    if (question_pool_id) {
      const poolCheck = await pool.query(
        'SELECT id FROM question_pools WHERE id = $1 AND created_by = $2',
        [question_pool_id, req.user.id]
      );
      if (!poolCheck.rows.length && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Nie masz dostepu do tej puli' });
      }
    }

    const result = await pool.query(
      `INSERT INTO quizzes
         (title, group_id, created_by, time_limit_sec, max_attempts,
          visible_from, visible_until, question_pool_id, draw_count, is_draft)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        title, group_id || null, req.user.id,
        time_limit_sec || null, max_attempts || 1,
        visible_from || null, visible_until || null,
        question_pool_id || null, draw_count || null,
        is_draft !== undefined ? is_draft : true
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Blad serwera' });
  }
});

// ============================================================
// GET /api/quizzes/:id  - szczegóły quizu z pytaniami
// ============================================================
router.get('/:id', authenticate, async (req, res) => {
  const quizId = parseInt(req.params.id);

  try {
    const quiz = await pool.query(
      `SELECT qs.*, qs.quiz_id AS id, u.username AS created_by_username,
              qp.name AS pool_name, qp.description AS pool_description
       FROM v_quiz_statistics qs
       JOIN users u ON u.id = qs.created_by
       LEFT JOIN question_pools qp ON qp.id = qs.question_pool_id
       WHERE qs.quiz_id = $1`,
      [quizId]
    );

    if (!quiz.rows.length) return res.status(404).json({ error: 'Quiz nie istnieje' });

    const q = quiz.rows[0];

    if (req.user.role === 'student') {
      if (q.is_draft) return res.status(403).json({ error: 'Quiz jest jeszcze w wersji roboczej' });
      const access = await pool.query(
        `SELECT 1 FROM group_users WHERE group_id = $1 AND user_id = $2 AND status = 'accepted'`,
        [q.group_id, req.user.id]
      );
      if (!access.rows.length) return res.status(403).json({ error: 'Brak dostepu do tego quizu' });
    }

    // Pobierz pytania - z puli lub ręcznie dodane
    let questions = [];
    if (q.question_pool_id) {
      const pq = await pool.query(
        `SELECT qb.id, qb.content, qb.latex_content, qb.question_type,
                ROW_NUMBER() OVER (ORDER BY pq.added_at) AS position
         FROM pool_questions pq
         JOIN question_bank qb ON pq.question_id = qb.id
         WHERE pq.pool_id = $1
         ORDER BY pq.added_at`,
        [q.question_pool_id]
      );
      questions = pq.rows;
    } else {
      const mq = await pool.query(
        `SELECT qb.id, qb.content, qb.latex_content, qb.question_type, qq.position
         FROM quiz_questions qq
         JOIN question_bank qb ON qq.question_id = qb.id
         WHERE qq.quiz_id = $1
         ORDER BY qq.position`,
        [quizId]
      );
      questions = mq.rows;
    }

    // Odpowiedzi per pytanie (studenci nie widzą is_correct)
    const isInstructor = req.user.role !== 'student';
    const questionsWithAnswers = await Promise.all(
      questions.map(async (question) => {
        const answers = await pool.query(
          `SELECT id, content, latex_content ${isInstructor ? ', is_correct' : ''}
           FROM answer_options WHERE question_id = $1 ORDER BY id`,
          [question.id]
        );
        return { ...question, answers: answers.rows };
      })
    );

    let myAttempts = null;
    if (req.user.role === 'student') {
      const att = await pool.query(
        `SELECT COUNT(*)::int AS cnt FROM quiz_attempts
         WHERE quiz_id = $1 AND user_id = $2`,
        [quizId, req.user.id]
      );
      myAttempts = att.rows[0].cnt;
    }

    res.json({ ...q, questions: questionsWithAnswers, my_attempts: myAttempts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Blad serwera' });
  }
});

// ============================================================
// PUT /api/quizzes/:id  - edytuj quiz
// Trigger trg_quiz_edit_log automatycznie zapisuje historię zmian.
// Ustawia SET LOCAL app.editor_id = X przed UPDATE.
// ============================================================
router.put('/:id', authenticate, requireRole('instructor', 'admin'), async (req, res) => {
  const quizId = parseInt(req.params.id);
  const {
    title, group_id, time_limit_sec, max_attempts,
    is_draft, visible_from, visible_until, question_pool_id, draw_count
  } = req.body;

  const client = await pool.connect();
  try {
    const quiz = await client.query('SELECT created_by FROM quizzes WHERE id = $1', [quizId]);
    if (!quiz.rows.length) return res.status(404).json({ error: 'Quiz nie istnieje' });
    if (quiz.rows[0].created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Brak uprawnien' });
    }

    await client.query('BEGIN');
    // Ustaw ID edytora dla triggera trg_quiz_edit_log (SET LOCAL działa w obrębie transakcji)
    await client.query(`SELECT set_config('app.editor_id', $1::text, true)`, [req.user.id]);

    const result = await client.query(
      `UPDATE quizzes SET
         title            = COALESCE($1, title),
         group_id         = COALESCE($2, group_id),
         time_limit_sec   = $3,
         max_attempts     = COALESCE($4, max_attempts),
         is_draft         = COALESCE($5, is_draft),
         visible_from     = $6,
         visible_until    = $7,
         question_pool_id = $8,
         draw_count       = $9
       WHERE id = $10
       RETURNING *`,
      [title, group_id, time_limit_sec, max_attempts, is_draft,
       visible_from, visible_until, question_pool_id, draw_count, quizId]
    );
    // Trigger fn_log_quiz_edit wpisuje historię do quiz_edit_history automatycznie

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Blad serwera' });
  } finally {
    client.release();
  }
});

// ============================================================
// POST /api/quizzes/:id/questions  - dodaj pytanie do quizu
// ============================================================
router.post('/:id/questions', authenticate, requireRole('instructor', 'admin'), async (req, res) => {
  const quizId = parseInt(req.params.id);
  const { question_id, position } = req.body;

  if (!question_id) return res.status(400).json({ error: 'ID pytania jest wymagane' });

  try {
    const quiz = await pool.query('SELECT created_by FROM quizzes WHERE id = $1', [quizId]);
    if (!quiz.rows.length) return res.status(404).json({ error: 'Quiz nie istnieje' });
    if (quiz.rows[0].created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Brak uprawnien' });
    }

    const question = await pool.query(
      `SELECT id FROM question_bank WHERE id = $1 AND (created_by = $2 OR is_public = true)`,
      [question_id, req.user.id]
    );
    if (!question.rows.length) return res.status(404).json({ error: 'Pytanie nie znalezione' });

    let pos = position;
    if (!pos) {
      const maxPos = await pool.query(
        'SELECT MAX(position) AS max FROM quiz_questions WHERE quiz_id = $1',
        [quizId]
      );
      pos = (maxPos.rows[0].max || 0) + 1;
    }

    await pool.query(
      `INSERT INTO quiz_questions (quiz_id, question_id, position)
       VALUES ($1, $2, $3)
       ON CONFLICT (quiz_id, question_id) DO UPDATE SET position = $3`,
      [quizId, question_id, pos]
    );

    res.status(201).json({ message: 'Pytanie dodane do quizu' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Blad serwera' });
  }
});

// ============================================================
// DELETE /api/quizzes/:id/questions/:questionId
// ============================================================
router.delete('/:id/questions/:questionId', authenticate, requireRole('instructor', 'admin'), async (req, res) => {
  const quizId = parseInt(req.params.id);
  const questionId = parseInt(req.params.questionId);

  try {
    const quiz = await pool.query('SELECT created_by FROM quizzes WHERE id = $1', [quizId]);
    if (!quiz.rows.length) return res.status(404).json({ error: 'Quiz nie istnieje' });
    if (quiz.rows[0].created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Brak uprawnien' });
    }

    await pool.query('DELETE FROM quiz_questions WHERE quiz_id = $1 AND question_id = $2', [quizId, questionId]);
    res.json({ message: 'Pytanie usuniete z quizu' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Blad serwera' });
  }
});

// ============================================================
// GET /api/quizzes/:id/history  - historia edycji quizu
// ============================================================
router.get('/:id/history', authenticate, requireRole('instructor', 'admin'), async (req, res) => {
  const quizId = parseInt(req.params.id);

  try {
    const quiz = await pool.query('SELECT created_by FROM quizzes WHERE id = $1', [quizId]);
    if (!quiz.rows.length) return res.status(404).json({ error: 'Quiz nie istnieje' });
    if (quiz.rows[0].created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Brak uprawnien' });
    }

    const result = await pool.query(
      `SELECT qeh.id, qeh.edited_at, qeh.change_summary,
              u.username AS edited_by_username
       FROM quiz_edit_history qeh
       LEFT JOIN users u ON u.id = qeh.edited_by
       WHERE qeh.quiz_id = $1
       ORDER BY qeh.edited_at DESC`,
      [quizId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Blad serwera' });
  }
});

module.exports = router;
