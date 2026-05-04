const express = require('express');
const pool = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// GET /api/quizzes  - lista quizów dostępnych dla użytkownika
// ============================================================
router.get('/', authenticate, async (req, res) => {
  try {
    let result;

    if (req.user.role === 'instructor' || req.user.role === 'admin') {
      result = await pool.query(
        `SELECT q.*, g.name as group_name,
                COUNT(DISTINCT qq.question_id) as question_count
         FROM quizzes q
         LEFT JOIN groups g ON q.group_id = g.id
         LEFT JOIN quiz_questions qq ON q.id = qq.quiz_id
         WHERE q.created_by = $1
         GROUP BY q.id, g.name
         ORDER BY q.created_at DESC`,
        [req.user.id]
      );
    } else {
      // Student widzi tylko quizy z grup, do których należy (accepted) i niebędące draft
      result = await pool.query(
        `SELECT q.*, g.name as group_name,
                COUNT(DISTINCT qq.question_id) as question_count,
                COUNT(DISTINCT qa.id) FILTER (WHERE qa.user_id = $1) as my_attempts
         FROM quizzes q
         JOIN groups g ON q.group_id = g.id
         JOIN group_users gu ON g.id = gu.group_id AND gu.user_id = $1 AND gu.status = 'accepted'
         LEFT JOIN quiz_questions qq ON q.id = qq.quiz_id
         LEFT JOIN quiz_attempts qa ON q.id = qa.quiz_id AND qa.user_id = $1
         WHERE q.is_draft = false
           AND (q.visible_from IS NULL OR q.visible_from <= NOW())
           AND (q.visible_until IS NULL OR q.visible_until >= NOW())
         GROUP BY q.id, g.name
         ORDER BY q.created_at DESC`,
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
// POST /api/quizzes  - utwórz quiz
// ============================================================
router.post('/', authenticate, requireRole('instructor', 'admin'), async (req, res) => {
  const { title, group_id, time_limit_sec, max_attempts, visible_from, visible_until } = req.body;

  if (!title) return res.status(400).json({ error: 'Tytuł quizu jest wymagany' });

  try {
    // Sprawdź czy instruktor jest właścicielem grupy
    if (group_id) {
      const group = await pool.query(
        'SELECT instructor_id FROM groups WHERE id = $1',
        [group_id]
      );
      if (!group.rows.length) return res.status(404).json({ error: 'Grupa nie istnieje' });
      if (group.rows[0].instructor_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Nie jesteś właścicielem tej grupy' });
      }
    }

    const result = await pool.query(
      `INSERT INTO quizzes (title, group_id, created_by, time_limit_sec, max_attempts, visible_from, visible_until)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [title, group_id || null, req.user.id, time_limit_sec || null, max_attempts || 1,
       visible_from || null, visible_until || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ============================================================
// GET /api/quizzes/:id  - szczegóły quizu
// ============================================================
router.get('/:id', authenticate, async (req, res) => {
  const quizId = parseInt(req.params.id);

  try {
    const quiz = await pool.query(
      `SELECT q.*, g.name as group_name, u.username as created_by_username
       FROM quizzes q
       LEFT JOIN groups g ON q.group_id = g.id
       JOIN users u ON q.created_by = u.id
       WHERE q.id = $1`,
      [quizId]
    );

    if (!quiz.rows.length) return res.status(404).json({ error: 'Quiz nie istnieje' });

    const q = quiz.rows[0];

    // Sprawdź dostęp studenta
    if (req.user.role === 'student') {
      if (q.is_draft) return res.status(403).json({ error: 'Quiz jest jeszcze w wersji roboczej' });

      const access = await pool.query(
        `SELECT 1 FROM group_users
         WHERE group_id = $1 AND user_id = $2 AND status = 'accepted'`,
        [q.group_id, req.user.id]
      );
      if (!access.rows.length) return res.status(403).json({ error: 'Brak dostępu do tego quizu' });
    }

    // Pobierz pytania z odpowiedziami
    const questions = await pool.query(
      `SELECT qb.id, qb.content, qb.latex_content, qb.question_type, qq.position
       FROM quiz_questions qq
       JOIN question_bank qb ON qq.question_id = qb.id
       WHERE qq.quiz_id = $1
       ORDER BY qq.position`,
      [quizId]
    );

    // Dla każdego pytania pobierz odpowiedzi (studenci NIE widzą is_correct)
    const questionsWithAnswers = await Promise.all(
      questions.rows.map(async (question) => {
        const answers = await pool.query(
          `SELECT id, content, latex_content
           ${req.user.role !== 'student' ? ', is_correct' : ''}
           FROM answer_options
           WHERE question_id = $1
           ORDER BY id`,
          [question.id]
        );
        return { ...question, answers: answers.rows };
      })
    );

    // Liczba podejść użytkownika
    let myAttempts = null;
    if (req.user.role === 'student') {
      const attempts = await pool.query(
        `SELECT COUNT(*) as count FROM quiz_attempts
         WHERE quiz_id = $1 AND user_id = $2`,
        [quizId, req.user.id]
      );
      myAttempts = parseInt(attempts.rows[0].count);
    }

    res.json({ ...q, questions: questionsWithAnswers, my_attempts: myAttempts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ============================================================
// PUT /api/quizzes/:id  - edytuj quiz
// ============================================================
router.put('/:id', authenticate, requireRole('instructor', 'admin'), async (req, res) => {
  const quizId = parseInt(req.params.id);
  const { title, group_id, time_limit_sec, max_attempts, is_draft, visible_from, visible_until } = req.body;

  try {
    const quiz = await pool.query('SELECT created_by FROM quizzes WHERE id = $1', [quizId]);
    if (!quiz.rows.length) return res.status(404).json({ error: 'Quiz nie istnieje' });
    if (quiz.rows[0].created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Brak uprawnień' });
    }

    const result = await pool.query(
      `UPDATE quizzes SET
         title = COALESCE($1, title),
         group_id = COALESCE($2, group_id),
         time_limit_sec = $3,
         max_attempts = COALESCE($4, max_attempts),
         is_draft = COALESCE($5, is_draft),
         visible_from = $6,
         visible_until = $7,
         updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [title, group_id, time_limit_sec, max_attempts, is_draft, visible_from, visible_until, quizId]
    );

    // Zapisz historię zmian
    await pool.query(
      `INSERT INTO quiz_edit_history (quiz_id, edited_by, change_summary)
       VALUES ($1, $2, $3)`,
      [quizId, req.user.id, `Zaktualizowano quiz: ${Object.keys(req.body).join(', ')}`]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
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
      return res.status(403).json({ error: 'Brak uprawnień' });
    }

    // Sprawdź czy pytanie istnieje i ma dostęp
    const question = await pool.query(
      `SELECT id FROM question_bank WHERE id = $1 AND (created_by = $2 OR is_public = true)`,
      [question_id, req.user.id]
    );
    if (!question.rows.length) return res.status(404).json({ error: 'Pytanie nie znalezione' });

    // Pobierz następną pozycję jeśli nie podano
    let pos = position;
    if (!pos) {
      const maxPos = await pool.query(
        'SELECT MAX(position) as max FROM quiz_questions WHERE quiz_id = $1',
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
    res.status(500).json({ error: 'Błąd serwera' });
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
      return res.status(403).json({ error: 'Brak uprawnień' });
    }

    await pool.query(
      'DELETE FROM quiz_questions WHERE quiz_id = $1 AND question_id = $2',
      [quizId, questionId]
    );

    res.json({ message: 'Pytanie usunięte z quizu' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;
