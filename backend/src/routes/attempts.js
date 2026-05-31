const express = require('express');
const pool = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// POST /api/attempts  - rozpocznij podejście do quizu
// Trigger trg_attempt_randomize automatycznie wypełnia
// attempt_question_order losową kolejnością pytań.
// ============================================================
router.post('/', authenticate, requireRole('student'), async (req, res) => {
  const { quiz_id } = req.body;
  if (!quiz_id) return res.status(400).json({ error: 'ID quizu jest wymagane' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const quiz = await client.query(
      `SELECT q.* FROM quizzes q WHERE q.id = $1`,
      [quiz_id]
    );

    if (!quiz.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Quiz nie istnieje' });
    }

    const q = quiz.rows[0];

    if (q.is_draft) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Quiz jest jeszcze w wersji roboczej' });
    }

    const now = new Date();
    if (q.visible_from && now < new Date(q.visible_from)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Quiz jeszcze niedostepny', available_from: q.visible_from });
    }
    if (q.visible_until && now > new Date(q.visible_until)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Czas na ten quiz minal' });
    }

    if (q.group_id) {
      const membership = await client.query(
        `SELECT 1 FROM group_users WHERE group_id = $1 AND user_id = $2 AND status = 'accepted'`,
        [q.group_id, req.user.id]
      );
      if (!membership.rows.length) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Nie nalezysz do grupy tego quizu' });
      }
    }

    // Blokada przed race condition
    await client.query(`SELECT id FROM quizzes WHERE id = $1 FOR UPDATE`, [quiz_id]);

    // Sprawdź limit podejść
    const attCount = await client.query(
      `SELECT COUNT(*) AS cnt FROM quiz_attempts
       WHERE quiz_id = $1 AND user_id = $2 AND status != 'in_progress'`,
      [quiz_id, req.user.id]
    );
    if (parseInt(attCount.rows[0].cnt) >= q.max_attempts) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: `Wyczerpales limit podejsc (${q.max_attempts})`,
        max_attempts: q.max_attempts
      });
    }

    // Sprawdź aktywne podejście
    const active = await client.query(
      `SELECT id, started_at FROM quiz_attempts
       WHERE quiz_id = $1 AND user_id = $2 AND status = 'in_progress'`,
      [quiz_id, req.user.id]
    );

    if (active.rows.length) {
      if (q.time_limit_sec) {
        const elapsed = (Date.now() - new Date(active.rows[0].started_at).getTime()) / 1000;
        if (elapsed > q.time_limit_sec) {
          // Trigger trg_attempt_auto_score obliczy wynik przy tej aktualizacji
          await client.query(
            `UPDATE quiz_attempts SET status = 'expired' WHERE id = $1`,
            [active.rows[0].id]
          );
        } else {
          await client.query('ROLLBACK');
          return res.status(409).json({
            error: 'Masz juz aktywne podejscie do tego quizu',
            attempt_id: active.rows[0].id,
            time_remaining: Math.round(q.time_limit_sec - elapsed)
          });
        }
      } else {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: 'Masz juz aktywne podejscie do tego quizu',
          attempt_id: active.rows[0].id
        });
      }
    }

    // Utwórz podejście - trigger trg_attempt_randomize wypełni attempt_question_order
    const attempt = await client.query(
      `INSERT INTO quiz_attempts (user_id, quiz_id, status)
       VALUES ($1, $2, 'in_progress')
       RETURNING *`,
      [req.user.id, quiz_id]
    );

    await client.query('COMMIT');

    const attemptId = attempt.rows[0].id;

    // Pytania w kolejności z attempt_question_order (losowej, unikalnej dla tego podejścia)
    const questions = await pool.query(
      `SELECT qb.id, qb.content, qb.latex_content, qb.question_type,
              aqo.position,
              json_agg(
                json_build_object('id', ao.id, 'content', ao.content, 'latex_content', ao.latex_content)
                ORDER BY ao.id
              ) AS answers
       FROM attempt_question_order aqo
       JOIN question_bank qb ON aqo.question_id = qb.id
       LEFT JOIN answer_options ao ON qb.id = ao.question_id
       WHERE aqo.attempt_id = $1
       GROUP BY qb.id, qb.content, qb.latex_content, qb.question_type, aqo.position
       ORDER BY aqo.position`,
      [attemptId]
    );

    res.status(201).json({
      attempt: attempt.rows[0],
      quiz: { id: q.id, title: q.title, time_limit_sec: q.time_limit_sec },
      questions: questions.rows
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Blad serwera' });
  } finally {
    client.release();
  }
});

// ============================================================
// POST /api/attempts/:id/answers  - zapisz odpowiedź
// ============================================================
router.post('/:id/answers', authenticate, requireRole('student'), async (req, res) => {
  const attemptId = parseInt(req.params.id);
  const { question_id, answer_ids } = req.body;

  if (!question_id || !answer_ids || !Array.isArray(answer_ids)) {
    return res.status(400).json({ error: 'question_id i answer_ids (tablica) sa wymagane' });
  }

  const client = await pool.connect();
  try {
    const attempt = await client.query(
      `SELECT qa.*, q.time_limit_sec FROM quiz_attempts qa
       JOIN quizzes q ON qa.quiz_id = q.id
       WHERE qa.id = $1 AND qa.user_id = $2`,
      [attemptId, req.user.id]
    );

    if (!attempt.rows.length) return res.status(404).json({ error: 'Podejscie nie znalezione' });

    const att = attempt.rows[0];
    if (att.status !== 'in_progress') {
      return res.status(400).json({ error: 'Podejscie jest juz zakonczone' });
    }

    if (att.time_limit_sec) {
      const elapsed = (Date.now() - new Date(att.started_at).getTime()) / 1000;
      if (elapsed > att.time_limit_sec) {
        await client.query(
          `UPDATE quiz_attempts SET status = 'expired' WHERE id = $1`,
          [attemptId]
        );
        return res.status(400).json({ error: 'Czas na quiz minal' });
      }
    }

    // Sprawdź czy pytanie należy do tego podejścia
    const qCheck = await client.query(
      `SELECT 1 FROM attempt_question_order WHERE attempt_id = $1 AND question_id = $2`,
      [attemptId, question_id]
    );
    if (!qCheck.rows.length) {
      return res.status(400).json({ error: 'To pytanie nie nalezy do tego podejscia' });
    }

    await client.query('BEGIN');
    await client.query(
      `DELETE FROM user_answers WHERE attempt_id = $1 AND question_id = $2`,
      [attemptId, question_id]
    );
    for (const answerId of answer_ids) {
      await client.query(
        `INSERT INTO user_answers (attempt_id, question_id, answer_id)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [attemptId, question_id, answerId]
      );
    }
    await client.query('COMMIT');

    res.json({ message: 'Odpowiedz zapisana' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Blad serwera' });
  } finally {
    client.release();
  }
});

// ============================================================
// POST /api/attempts/:id/finish  - zakończ podejście
// Trigger trg_attempt_auto_score oblicza wynik w bazie danych
// przez funkcję calculate_attempt_score(). Aplikacja tylko
// zmienia status - wynik wraca w RETURNING *.
// ============================================================
router.post('/:id/finish', authenticate, requireRole('student'), async (req, res) => {
  const attemptId = parseInt(req.params.id);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const attempt = await client.query(
      `SELECT qa.*, q.time_limit_sec FROM quiz_attempts qa
       JOIN quizzes q ON qa.quiz_id = q.id
       WHERE qa.id = $1 AND qa.user_id = $2 AND qa.status = 'in_progress'
       FOR UPDATE`,
      [attemptId, req.user.id]
    );

    if (!attempt.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Aktywne podejscie nie znalezione' });
    }

    const att = attempt.rows[0];
    const status = (() => {
      if (!att.time_limit_sec) return 'completed';
      const elapsed = (Date.now() - new Date(att.started_at).getTime()) / 1000;
      return elapsed > att.time_limit_sec ? 'expired' : 'completed';
    })();

    // Trigger fn_auto_score_attempt oblicza score przez calculate_attempt_score()
    // i ustawia finished_at. RETURNING * zwraca wiersz po triggerze.
    const updated = await client.query(
      `UPDATE quiz_attempts SET status = $1
       WHERE id = $2
       RETURNING *`,
      [status, attemptId]
    );

    await client.query('COMMIT');

    // Pobierz pełne wyniki z widoku v_student_quiz_results
    const summary = await pool.query(
      `SELECT * FROM v_student_quiz_results WHERE attempt_id = $1`,
      [attemptId]
    );

    const row = summary.rows[0];
    res.json({
      attempt: updated.rows[0],
      score: row?.score ?? 0,
      total_questions: row?.total_questions ?? 0,
      percentage: row?.percentage ?? 0,
      status
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Blad serwera' });
  } finally {
    client.release();
  }
});

// ============================================================
// GET /api/attempts  - historia podejść
// Używa widoku v_student_quiz_results dla uproszczenia zapytań.
// ============================================================
router.get('/', authenticate, async (req, res) => {
  const { quiz_id } = req.query;

  try {
    let result;

    if (req.user.role === 'student') {
      result = await pool.query(
        `SELECT * FROM v_student_quiz_results
         WHERE user_id = $1
         ${quiz_id ? 'AND quiz_id = $2' : ''}
         ORDER BY started_at DESC`,
        quiz_id ? [req.user.id, quiz_id] : [req.user.id]
      );
    } else {
      result = await pool.query(
        `SELECT * FROM v_student_quiz_results
         WHERE quiz_id IN (SELECT id FROM quizzes WHERE created_by = $1)
         ${quiz_id ? 'AND quiz_id = $2' : ''}
         ORDER BY started_at DESC`,
        quiz_id ? [req.user.id, quiz_id] : [req.user.id]
      );
    }

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Blad serwera' });
  }
});

// ============================================================
// GET /api/attempts/:id  - szczegóły podejścia
// ============================================================
router.get('/:id', authenticate, async (req, res) => {
  const attemptId = parseInt(req.params.id);

  try {
    const summary = await pool.query(
      `SELECT * FROM v_student_quiz_results WHERE attempt_id = $1`,
      [attemptId]
    );

    if (!summary.rows.length) return res.status(404).json({ error: 'Podejscie nie znalezione' });

    const att = summary.rows[0];

    if (req.user.role === 'student' && att.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Brak dostepu' });
    }

    let answers = [];
    if (att.status !== 'in_progress') {
      const result = await pool.query(
        `SELECT ua.question_id, ua.answer_id,
                ao.content AS answer_content, ao.is_correct,
                qb.content AS question_content, qb.question_type,
                aqo.position
         FROM user_answers ua
         JOIN answer_options ao ON ua.answer_id = ao.id
         JOIN question_bank qb ON ua.question_id = qb.id
         JOIN attempt_question_order aqo ON aqo.attempt_id = ua.attempt_id
           AND aqo.question_id = ua.question_id
         WHERE ua.attempt_id = $1
         ORDER BY aqo.position, ua.question_id`,
        [attemptId]
      );
      answers = result.rows;
    }

    res.json({ ...att, answers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Blad serwera' });
  }
});

module.exports = router;
