const express = require('express');
const pool = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// POST /api/attempts  - rozpocznij podejście do quizu
// ============================================================
router.post('/', authenticate, requireRole('student'), async (req, res) => {
  const { quiz_id } = req.body;
  if (!quiz_id) return res.status(400).json({ error: 'ID quizu jest wymagane' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Pobierz quiz
    const quiz = await client.query(
      `SELECT q.*, g.id as gid FROM quizzes q
       LEFT JOIN groups g ON q.group_id = g.id
       WHERE q.id = $1`,
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

    // Sprawdź okno czasowe
    const now = new Date();
    if (q.visible_from && now < new Date(q.visible_from)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Quiz jeszcze niedostępny', available_from: q.visible_from });
    }
    if (q.visible_until && now > new Date(q.visible_until)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Czas na ten quiz minął' });
    }

    // Sprawdź przynależność do grupy
    if (q.group_id) {
      const membership = await client.query(
        `SELECT 1 FROM group_users WHERE group_id = $1 AND user_id = $2 AND status = 'accepted'`,
        [q.group_id, req.user.id]
      );
      if (!membership.rows.length) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Nie należysz do grupy tego quizu' });
      }
    }

    // Sprawdź limit podejść (SELECT FOR UPDATE - ochrona przed race condition)
    const attemptsCount = await client.query(
      `SELECT COUNT(*) as count FROM quiz_attempts
       WHERE quiz_id = $1 AND user_id = $2 AND status != 'in_progress'
       FOR UPDATE`,
      [quiz_id, req.user.id]
    );

    if (parseInt(attemptsCount.rows[0].count) >= q.max_attempts) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: `Wyczerpałeś limit podejść (${q.max_attempts})`,
        max_attempts: q.max_attempts
      });
    }

    // Sprawdź czy nie ma aktywnego podejścia
    const activeAttempt = await client.query(
      `SELECT id, started_at FROM quiz_attempts
       WHERE quiz_id = $1 AND user_id = $2 AND status = 'in_progress'`,
      [quiz_id, req.user.id]
    );

    if (activeAttempt.rows.length) {
      // Sprawdź czy nie wygasło
      if (q.time_limit_sec) {
        const startedAt = new Date(activeAttempt.rows[0].started_at);
        const elapsed = (Date.now() - startedAt.getTime()) / 1000;
        if (elapsed > q.time_limit_sec) {
          await client.query(
            `UPDATE quiz_attempts SET status = 'expired', finished_at = NOW() WHERE id = $1`,
            [activeAttempt.rows[0].id]
          );
        } else {
          await client.query('ROLLBACK');
          return res.status(409).json({
            error: 'Masz już aktywne podejście do tego quizu',
            attempt_id: activeAttempt.rows[0].id,
            time_remaining: Math.round(q.time_limit_sec - elapsed)
          });
        }
      } else {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: 'Masz już aktywne podejście do tego quizu',
          attempt_id: activeAttempt.rows[0].id
        });
      }
    }

    // Utwórz nowe podejście
    const attempt = await client.query(
      `INSERT INTO quiz_attempts (user_id, quiz_id, status)
       VALUES ($1, $2, 'in_progress')
       RETURNING *`,
      [req.user.id, quiz_id]
    );

    await client.query('COMMIT');

    // Pobierz pytania (bez poprawnych odpowiedzi!)
    const questions = await pool.query(
      `SELECT qb.id, qb.content, qb.latex_content, qb.question_type, qq.position,
              json_agg(json_build_object('id', ao.id, 'content', ao.content, 'latex_content', ao.latex_content)
                       ORDER BY ao.id) as answers
       FROM quiz_questions qq
       JOIN question_bank qb ON qq.question_id = qb.id
       LEFT JOIN answer_options ao ON qb.id = ao.question_id
       WHERE qq.quiz_id = $1
       GROUP BY qb.id, qb.content, qb.latex_content, qb.question_type, qq.position
       ORDER BY qq.position`,
      [quiz_id]
    );

    res.status(201).json({
      attempt: attempt.rows[0],
      quiz: {
        id: q.id,
        title: q.title,
        time_limit_sec: q.time_limit_sec
      },
      questions: questions.rows
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
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
    return res.status(400).json({ error: 'question_id i answer_ids (tablica) są wymagane' });
  }

  const client = await pool.connect();
  try {
    // Sprawdź podejście
    const attempt = await client.query(
      `SELECT qa.*, q.time_limit_sec FROM quiz_attempts qa
       JOIN quizzes q ON qa.quiz_id = q.id
       WHERE qa.id = $1 AND qa.user_id = $2`,
      [attemptId, req.user.id]
    );

    if (!attempt.rows.length) {
      return res.status(404).json({ error: 'Podejście nie znalezione' });
    }

    const att = attempt.rows[0];

    if (att.status !== 'in_progress') {
      return res.status(400).json({ error: 'Podejście jest już zakończone' });
    }

    // Sprawdź limit czasu
    if (att.time_limit_sec) {
      const elapsed = (Date.now() - new Date(att.started_at).getTime()) / 1000;
      if (elapsed > att.time_limit_sec) {
        await client.query(
          `UPDATE quiz_attempts SET status = 'expired', finished_at = NOW() WHERE id = $1`,
          [attemptId]
        );
        return res.status(400).json({ error: 'Czas na quiz minął' });
      }
    }

    await client.query('BEGIN');

    // Usuń poprzednie odpowiedzi na to pytanie w tym podejściu
    await client.query(
      `DELETE FROM user_answers WHERE attempt_id = $1 AND question_id = $2`,
      [attemptId, question_id]
    );

    // Wstaw nowe odpowiedzi
    for (const answerId of answer_ids) {
      await client.query(
        `INSERT INTO user_answers (attempt_id, question_id, answer_id)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [attemptId, question_id, answerId]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Odpowiedź zapisana' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  } finally {
    client.release();
  }
});

// ============================================================
// POST /api/attempts/:id/finish  - zakończ podejście i oblicz wynik
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
      return res.status(404).json({ error: 'Aktywne podejście nie znalezione' });
    }

    const att = attempt.rows[0];
    const status = (() => {
      if (!att.time_limit_sec) return 'completed';
      const elapsed = (Date.now() - new Date(att.started_at).getTime()) / 1000;
      return elapsed > att.time_limit_sec ? 'expired' : 'completed';
    })();

    // Oblicz wynik: dla każdego pytania sprawdź czy wszystkie zaznaczone odpowiedzi są poprawne
    // i czy nie pominięto żadnej poprawnej
    const scoreResult = await client.query(
      `WITH question_answers AS (
         SELECT
           ua.question_id,
           COUNT(CASE WHEN ao.is_correct = true THEN 1 END) as selected_correct,
           COUNT(CASE WHEN ao.is_correct = false THEN 1 END) as selected_wrong,
           (SELECT COUNT(*) FROM answer_options ao2
            WHERE ao2.question_id = ua.question_id AND ao2.is_correct = true) as total_correct
         FROM user_answers ua
         JOIN answer_options ao ON ua.answer_id = ao.id
         WHERE ua.attempt_id = $1
         GROUP BY ua.question_id
       )
       SELECT COUNT(*) as score FROM question_answers
       WHERE selected_correct = total_correct AND selected_wrong = 0`,
      [attemptId]
    );

    const score = parseInt(scoreResult.rows[0].score);

    const updated = await client.query(
      `UPDATE quiz_attempts
       SET status = $1, finished_at = NOW(), score = $2
       WHERE id = $3
       RETURNING *`,
      [status, score, attemptId]
    );

    await client.query('COMMIT');

    // Pobierz poprawne odpowiedzi do pokazania studentowi
    const reviewData = await pool.query(
      `SELECT ua.question_id, ua.answer_id,
              ao.is_correct as is_selected_correct,
              qb.content as question_content,
              qb.question_type
       FROM user_answers ua
       JOIN answer_options ao ON ua.answer_id = ao.id
       JOIN question_bank qb ON ua.question_id = qb.id
       WHERE ua.attempt_id = $1`,
      [attemptId]
    );

    // Całkowita liczba pytań
    const totalQuestions = await pool.query(
      `SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = $1`,
      [att.quiz_id]
    );

    res.json({
      attempt: updated.rows[0],
      score,
      total_questions: parseInt(totalQuestions.rows[0].count),
      percentage: Math.round((score / parseInt(totalQuestions.rows[0].count)) * 100),
      status
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  } finally {
    client.release();
  }
});

// ============================================================
// GET /api/attempts  - historia podejść użytkownika
// ============================================================
router.get('/', authenticate, async (req, res) => {
  const { quiz_id } = req.query;

  try {
    let query, params;

    if (req.user.role === 'student') {
      query = `SELECT qa.*, q.title as quiz_title,
                      (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = q.id) as total_questions
               FROM quiz_attempts qa
               JOIN quizzes q ON qa.quiz_id = q.id
               WHERE qa.user_id = $1
               ${quiz_id ? 'AND qa.quiz_id = $2' : ''}
               ORDER BY qa.started_at DESC`;
      params = quiz_id ? [req.user.id, quiz_id] : [req.user.id];
    } else {
      // Instruktor widzi podejścia do swoich quizów
      query = `SELECT qa.*, q.title as quiz_title, u.username, u.first_name, u.last_name,
                      (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = q.id) as total_questions
               FROM quiz_attempts qa
               JOIN quizzes q ON qa.quiz_id = q.id
               JOIN users u ON qa.user_id = u.id
               WHERE q.created_by = $1
               ${quiz_id ? 'AND qa.quiz_id = $2' : ''}
               ORDER BY qa.started_at DESC`;
      params = quiz_id ? [req.user.id, quiz_id] : [req.user.id];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ============================================================
// GET /api/attempts/:id  - szczegóły podejścia (wyniki)
// ============================================================
router.get('/:id', authenticate, async (req, res) => {
  const attemptId = parseInt(req.params.id);

  try {
    const attempt = await pool.query(
      `SELECT qa.*, q.title as quiz_title, q.time_limit_sec
       FROM quiz_attempts qa
       JOIN quizzes q ON qa.quiz_id = q.id
       WHERE qa.id = $1`,
      [attemptId]
    );

    if (!attempt.rows.length) return res.status(404).json({ error: 'Podejście nie znalezione' });

    const att = attempt.rows[0];

    // Sprawdź dostęp
    if (req.user.role === 'student' && att.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Brak dostępu' });
    }

    // Pobierz odpowiedzi z oznaczeniem poprawności (tylko dla zakończonych)
    let answers = [];
    if (att.status !== 'in_progress') {
      const result = await pool.query(
        `SELECT ua.question_id, ua.answer_id, ao.content as answer_content,
                ao.is_correct, qb.content as question_content, qb.question_type
         FROM user_answers ua
         JOIN answer_options ao ON ua.answer_id = ao.id
         JOIN question_bank qb ON ua.question_id = qb.id
         WHERE ua.attempt_id = $1
         ORDER BY ua.question_id`,
        [attemptId]
      );
      answers = result.rows;
    }

    res.json({ ...att, answers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;
