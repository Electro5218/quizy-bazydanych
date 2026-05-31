require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const pool = require('./pool');

const schema = `
-- ============================================================
-- ROZSZERZENIA
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- TYPY ENUM
-- ============================================================
DO $$ BEGIN
  CREATE TYPE enum_role AS ENUM ('student', 'instructor', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE enum_group_status AS ENUM ('pending', 'accepted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE enum_attempt_status AS ENUM ('in_progress', 'completed', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE enum_question_type AS ENUM ('single', 'multiple');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE enum_visibility_target AS ENUM ('group', 'user');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- TABELA: users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id             SERIAL PRIMARY KEY,
  email          VARCHAR(255) NOT NULL UNIQUE,
  username       VARCHAR(100) NOT NULL UNIQUE,
  first_name     VARCHAR(100),
  last_name      VARCHAR(100),
  password_hash  VARCHAR(255) NOT NULL,
  role           enum_role    NOT NULL DEFAULT 'student',
  email_verified BOOLEAN      DEFAULT false,
  email_verified_at TIMESTAMP,
  is_deleted     BOOLEAN      DEFAULT false,
  is_blocked     BOOLEAN      DEFAULT false,
  created_at     TIMESTAMPTZ  DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  DEFAULT NOW()
);

-- ============================================================
-- TABELA: email_verification_tokens
-- ============================================================
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
  is_used    BOOLEAN DEFAULT false
);

-- ============================================================
-- TABELA: password_reset_tokens
-- ============================================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '15 minutes',
  is_used    BOOLEAN DEFAULT false
);

-- ============================================================
-- TABELA: login_attempts
-- ============================================================
CREATE TABLE IF NOT EXISTS login_attempts (
  id           SERIAL PRIMARY KEY,
  user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success      BOOLEAN NOT NULL,
  locked_until TIMESTAMPTZ,
  ip_address   INET
);

-- ============================================================
-- TABELA: groups
-- ============================================================
CREATE TABLE IF NOT EXISTS groups (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(200) NOT NULL,
  instructor_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  join_code     VARCHAR(20) NOT NULL UNIQUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: group_users
-- ============================================================
CREATE TABLE IF NOT EXISTS group_users (
  group_id  INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status    enum_group_status NOT NULL DEFAULT 'pending',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

-- ============================================================
-- TABELA: question_bank (centralny bank pytań)
-- ============================================================
CREATE TABLE IF NOT EXISTS question_bank (
  id            SERIAL PRIMARY KEY,
  created_by    INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  content       TEXT NOT NULL,
  latex_content TEXT,
  question_type enum_question_type NOT NULL DEFAULT 'single',
  is_public     BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: answer_options
-- ============================================================
CREATE TABLE IF NOT EXISTS answer_options (
  id            SERIAL PRIMARY KEY,
  question_id   INT NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  latex_content TEXT,
  is_correct    BOOLEAN NOT NULL DEFAULT false
);

-- ============================================================
-- TABELA: question_pools (pule pytań tworzone przez instruktorów)
-- ============================================================
CREATE TABLE IF NOT EXISTS question_pools (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  created_by  INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: pool_questions (pytania w puli)
-- ============================================================
CREATE TABLE IF NOT EXISTS pool_questions (
  pool_id     INT NOT NULL REFERENCES question_pools(id) ON DELETE CASCADE,
  question_id INT NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
  added_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (pool_id, question_id)
);

-- ============================================================
-- TABELA: quizzes
-- ============================================================
CREATE TABLE IF NOT EXISTS quizzes (
  id                SERIAL PRIMARY KEY,
  title             VARCHAR(300) NOT NULL,
  group_id          INT REFERENCES groups(id) ON DELETE SET NULL,
  created_by        INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  time_limit_sec    INT,
  max_attempts      INT NOT NULL DEFAULT 1,
  is_draft          BOOLEAN DEFAULT true,
  visible_from      TIMESTAMPTZ,
  visible_until     TIMESTAMPTZ,
  question_pool_id  INT REFERENCES question_pools(id) ON DELETE SET NULL,
  draw_count        INT CHECK (draw_count IS NULL OR draw_count > 0),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Dodaj kolumny do quizzes jeśli tabela już istnieje bez nich
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS question_pool_id INT REFERENCES question_pools(id) ON DELETE SET NULL;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS draw_count INT CHECK (draw_count IS NULL OR draw_count > 0);

-- ============================================================
-- TABELA: quiz_visibility
-- ============================================================
CREATE TABLE IF NOT EXISTS quiz_visibility (
  id          SERIAL PRIMARY KEY,
  quiz_id     INT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  target_type enum_visibility_target NOT NULL,
  target_id   INT NOT NULL
);

-- ============================================================
-- TABELA: quiz_questions (ręcznie dodane pytania do quizu)
-- ============================================================
CREATE TABLE IF NOT EXISTS quiz_questions (
  quiz_id     INT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_id INT NOT NULL REFERENCES question_bank(id) ON DELETE RESTRICT,
  position    INT NOT NULL DEFAULT 0,
  PRIMARY KEY (quiz_id, question_id)
);

-- ============================================================
-- TABELA: quiz_attempts
-- ============================================================
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  quiz_id     INT NOT NULL REFERENCES quizzes(id) ON DELETE RESTRICT,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  score       INT,
  status      enum_attempt_status NOT NULL DEFAULT 'in_progress'
);

-- ============================================================
-- TABELA: attempt_question_order (losowa kolejność pytań per podejście)
-- Każdy student widzi pytania w innej kolejności.
-- Wypełniana automatycznie triggerem po INSERT na quiz_attempts.
-- ============================================================
CREATE TABLE IF NOT EXISTS attempt_question_order (
  attempt_id  INT NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id INT NOT NULL REFERENCES question_bank(id) ON DELETE RESTRICT,
  position    INT NOT NULL,
  PRIMARY KEY (attempt_id, question_id)
);

-- ============================================================
-- TABELA: user_answers
-- ============================================================
CREATE TABLE IF NOT EXISTS user_answers (
  attempt_id  INT NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id INT NOT NULL REFERENCES question_bank(id) ON DELETE RESTRICT,
  answer_id   INT NOT NULL REFERENCES answer_options(id) ON DELETE RESTRICT,
  answered_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (attempt_id, question_id, answer_id)
);

-- ============================================================
-- TABELA: quiz_edit_history
-- ============================================================
CREATE TABLE IF NOT EXISTS quiz_edit_history (
  id             SERIAL PRIMARY KEY,
  quiz_id        INT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  edited_by      INT REFERENCES users(id) ON DELETE SET NULL,
  edited_at      TIMESTAMPTZ DEFAULT NOW(),
  change_summary TEXT
);

-- ============================================================
-- INDEKSY
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_email            ON users(email);
CREATE INDEX IF NOT EXISTS idx_group_users_user       ON group_users(user_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_group          ON quizzes(group_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_pool           ON quizzes(question_pool_id);
CREATE INDEX IF NOT EXISTS idx_questions_quiz         ON quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_answers_question       ON answer_options(question_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user_quiz     ON quiz_attempts(user_id, quiz_id);
CREATE INDEX IF NOT EXISTS idx_attempts_status        ON quiz_attempts(status);
CREATE INDEX IF NOT EXISTS idx_attempt_order          ON attempt_question_order(attempt_id);
CREATE INDEX IF NOT EXISTS idx_user_answers_attempt   ON user_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_pool_questions_pool    ON pool_questions(pool_id);
CREATE INDEX IF NOT EXISTS idx_pool_questions_q       ON pool_questions(question_id);
CREATE INDEX IF NOT EXISTS idx_reset_token            ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_login_attempts_user    ON login_attempts(user_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_verify_token     ON email_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_quiz_visibility_quiz   ON quiz_visibility(quiz_id);

-- ============================================================
-- FUNKCJE POMOCNICZE
-- ============================================================

-- Hashowanie hasła przez pgcrypto (blowfish/bcrypt, 12 rund)
CREATE OR REPLACE FUNCTION hash_password(plain_password TEXT)
RETURNS TEXT AS $$
  SELECT crypt(plain_password, gen_salt('bf', 12));
$$ LANGUAGE sql SECURITY DEFINER;

-- Weryfikacja hasła
CREATE OR REPLACE FUNCTION verify_password(plain_password TEXT, stored_hash TEXT)
RETURNS BOOLEAN AS $$
  SELECT crypt(plain_password, stored_hash) = stored_hash;
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================
-- FUNKCJA: obliczanie wyniku podejścia
-- Iteruje po pytaniach z attempt_question_order,
-- punkt = 0 błędnych + wszystkie poprawne zaznaczone.
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_attempt_score(p_attempt_id INT)
RETURNS INT AS $$
DECLARE
  v_score        INT := 0;
  v_qid          INT;
  v_sel_correct  BIGINT;
  v_sel_wrong    BIGINT;
  v_tot_correct  BIGINT;
BEGIN
  FOR v_qid IN
    SELECT question_id FROM attempt_question_order WHERE attempt_id = p_attempt_id
  LOOP
    SELECT COUNT(*) INTO v_tot_correct
    FROM answer_options WHERE question_id = v_qid AND is_correct = true;

    SELECT COUNT(*) INTO v_sel_correct
    FROM user_answers ua
    JOIN answer_options ao ON ao.id = ua.answer_id
    WHERE ua.attempt_id = p_attempt_id
      AND ua.question_id = v_qid
      AND ao.is_correct = true;

    SELECT COUNT(*) INTO v_sel_wrong
    FROM user_answers ua
    JOIN answer_options ao ON ao.id = ua.answer_id
    WHERE ua.attempt_id = p_attempt_id
      AND ua.question_id = v_qid
      AND ao.is_correct = false;

    IF v_sel_wrong = 0 AND v_sel_correct = v_tot_correct AND v_tot_correct > 0 THEN
      v_score := v_score + 1;
    END IF;
  END LOOP;
  RETURN v_score;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNKCJA TRIGGERA: aktualizacja updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNKCJA TRIGGERA: losowanie pytań przy starcie podejścia
-- Jeśli quiz ma question_pool_id → losuje z puli (draw_count lub wszystkie).
-- W przeciwnym razie losuje z quiz_questions.
-- Każdy student dostaje inną kolejność.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_randomize_attempt_questions()
RETURNS TRIGGER AS $$
DECLARE
  v_pool_id    INT;
  v_draw_count INT;
BEGIN
  SELECT q.question_pool_id, q.draw_count
  INTO v_pool_id, v_draw_count
  FROM quizzes q
  WHERE q.id = NEW.quiz_id;

  IF v_pool_id IS NOT NULL THEN
    INSERT INTO attempt_question_order (attempt_id, question_id, position)
    SELECT NEW.id, question_id, ROW_NUMBER() OVER (ORDER BY rnd)
    FROM (
      SELECT pq.question_id, RANDOM() AS rnd
      FROM pool_questions pq
      WHERE pq.pool_id = v_pool_id
      ORDER BY rnd
      LIMIT COALESCE(v_draw_count, 2147483647)
    ) sub;
  ELSE
    INSERT INTO attempt_question_order (attempt_id, question_id, position)
    SELECT NEW.id, question_id, ROW_NUMBER() OVER (ORDER BY rnd)
    FROM (
      SELECT qq.question_id, RANDOM() AS rnd
      FROM quiz_questions qq
      WHERE qq.quiz_id = NEW.quiz_id
      ORDER BY rnd
    ) sub;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNKCJA TRIGGERA: automatyczne obliczanie wyniku
-- Odpala się BEFORE UPDATE gdy status zmienia się na completed/expired.
-- Ustala score i finished_at bez udziału aplikacji.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_auto_score_attempt()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('completed', 'expired') AND OLD.status = 'in_progress' THEN
    NEW.score       := calculate_attempt_score(NEW.id);
    NEW.finished_at := COALESCE(NEW.finished_at, NOW());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNKCJA TRIGGERA: automatyczna historia zmian quizu
-- Czyta ID edytora ze zmiennej sesji app.editor_id
-- (ustawianej przez aplikację: SET LOCAL app.editor_id = X).
-- ============================================================
CREATE OR REPLACE FUNCTION fn_log_quiz_edit()
RETURNS TRIGGER AS $$
DECLARE
  v_editor_id INT;
  v_changes   TEXT := '';
BEGIN
  BEGIN
    v_editor_id := NULLIF(current_setting('app.editor_id', true), '')::INT;
  EXCEPTION WHEN OTHERS THEN
    v_editor_id := NULL;
  END;
  IF v_editor_id IS NULL THEN
    v_editor_id := NEW.created_by;
  END IF;

  IF OLD.title IS DISTINCT FROM NEW.title THEN
    v_changes := v_changes || format('title: "%s"->"%s"; ', OLD.title, NEW.title);
  END IF;
  IF OLD.time_limit_sec IS DISTINCT FROM NEW.time_limit_sec THEN
    v_changes := v_changes || format('time_limit: %s->%s; ', OLD.time_limit_sec, NEW.time_limit_sec);
  END IF;
  IF OLD.max_attempts IS DISTINCT FROM NEW.max_attempts THEN
    v_changes := v_changes || format('max_attempts: %s->%s; ', OLD.max_attempts, NEW.max_attempts);
  END IF;
  IF OLD.is_draft IS DISTINCT FROM NEW.is_draft THEN
    v_changes := v_changes || format('is_draft: %s->%s; ', OLD.is_draft, NEW.is_draft);
  END IF;
  IF OLD.question_pool_id IS DISTINCT FROM NEW.question_pool_id THEN
    v_changes := v_changes || format('pool_id: %s->%s; ', OLD.question_pool_id, NEW.question_pool_id);
  END IF;
  IF OLD.draw_count IS DISTINCT FROM NEW.draw_count THEN
    v_changes := v_changes || format('draw_count: %s->%s; ', OLD.draw_count, NEW.draw_count);
  END IF;

  IF v_changes <> '' THEN
    INSERT INTO quiz_edit_history (quiz_id, edited_by, change_summary)
    VALUES (NEW.id, v_editor_id, RTRIM(v_changes, ' '));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGERY
-- ============================================================

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

DROP TRIGGER IF EXISTS trg_quizzes_updated_at ON quizzes;
CREATE TRIGGER trg_quizzes_updated_at
  BEFORE UPDATE ON quizzes
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- Po wstawieniu podejścia: losuje kolejność pytań
DROP TRIGGER IF EXISTS trg_attempt_randomize ON quiz_attempts;
CREATE TRIGGER trg_attempt_randomize
  AFTER INSERT ON quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION fn_randomize_attempt_questions();

-- Przed zmianą statusu: oblicza wynik przez bazę danych
DROP TRIGGER IF EXISTS trg_attempt_auto_score ON quiz_attempts;
CREATE TRIGGER trg_attempt_auto_score
  BEFORE UPDATE ON quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION fn_auto_score_attempt();

-- Po edycji quizu: zapisuje historię zmian (editor_id z SET LOCAL)
DROP TRIGGER IF EXISTS trg_quiz_edit_log ON quizzes;
CREATE TRIGGER trg_quiz_edit_log
  AFTER UPDATE ON quizzes
  FOR EACH ROW EXECUTE FUNCTION fn_log_quiz_edit();

-- ============================================================
-- WIDOKI
-- ============================================================

-- Statystyki per quiz (używany w API /api/quizzes)
CREATE OR REPLACE VIEW v_quiz_statistics AS
SELECT
  q.id                  AS quiz_id,
  q.title,
  q.group_id,
  g.name                AS group_name,
  q.created_by,
  q.max_attempts,
  q.time_limit_sec,
  q.is_draft,
  q.question_pool_id,
  q.draw_count,
  q.visible_from,
  q.visible_until,
  q.created_at,
  q.updated_at,
  CASE
    WHEN q.question_pool_id IS NOT NULL
      THEN COALESCE(
        (SELECT COUNT(*) FROM pool_questions WHERE pool_id = q.question_pool_id),
        0
      )
    ELSE COUNT(DISTINCT qq.question_id)
  END                   AS question_count,
  COUNT(DISTINCT qa.id)       AS attempt_count,
  COUNT(DISTINCT qa.user_id)  AS student_count,
  ROUND(AVG(qa.score)::numeric, 2) AS avg_score,
  MAX(qa.score)               AS max_score,
  MIN(qa.score)               AS min_score
FROM quizzes q
LEFT JOIN groups g ON g.id = q.group_id
LEFT JOIN quiz_questions qq ON qq.quiz_id = q.id
LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id AND qa.status = 'completed'
GROUP BY q.id, q.title, q.group_id, g.name, q.created_by, q.max_attempts,
         q.time_limit_sec, q.is_draft, q.question_pool_id, q.draw_count,
         q.visible_from, q.visible_until, q.created_at, q.updated_at;

-- Wyniki studentów z procentami i czasem trwania
CREATE OR REPLACE VIEW v_student_quiz_results AS
SELECT
  qa.id                                AS attempt_id,
  qa.user_id,
  u.username,
  TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')) AS full_name,
  qa.quiz_id,
  q.title                              AS quiz_title,
  g.name                               AS group_name,
  qa.score,
  COUNT(aqo.question_id)::int          AS total_questions,
  CASE
    WHEN COUNT(aqo.question_id) > 0
    THEN ROUND(COALESCE(qa.score,0)::numeric / COUNT(aqo.question_id) * 100, 2)
    ELSE 0
  END                                  AS percentage,
  qa.started_at,
  qa.finished_at,
  CASE
    WHEN qa.finished_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (qa.finished_at - qa.started_at))::int
    ELSE NULL
  END                                  AS duration_sec,
  qa.status
FROM quiz_attempts qa
JOIN users u ON u.id = qa.user_id
JOIN quizzes q ON q.id = qa.quiz_id
LEFT JOIN groups g ON g.id = q.group_id
LEFT JOIN attempt_question_order aqo ON aqo.attempt_id = qa.id
GROUP BY qa.id, qa.user_id, u.username, u.first_name, u.last_name,
         qa.quiz_id, q.title, g.name, qa.score, qa.started_at, qa.finished_at, qa.status;

-- Statystyki użycia pytań z banku
CREATE OR REPLACE VIEW v_question_pool_stats AS
SELECT
  qb.id                                AS question_id,
  qb.content,
  qb.question_type,
  qb.created_by,
  u.username                           AS created_by_username,
  qb.is_public,
  qb.created_at,
  COUNT(DISTINCT qq.quiz_id)           AS used_in_quizzes,
  COUNT(DISTINCT pq.pool_id)           AS used_in_pools,
  COUNT(DISTINCT ua.attempt_id)        AS times_answered,
  COUNT(ao.id)                         AS answer_count
FROM question_bank qb
JOIN users u ON u.id = qb.created_by
LEFT JOIN quiz_questions qq ON qq.question_id = qb.id
LEFT JOIN pool_questions pq ON pq.question_id = qb.id
LEFT JOIN user_answers ua ON ua.question_id = qb.id
LEFT JOIN answer_options ao ON ao.question_id = qb.id
GROUP BY qb.id, qb.content, qb.question_type, qb.created_by,
         u.username, qb.is_public, qb.created_at;

-- Podgląd aktywności logowania (dla admina)
CREATE OR REPLACE VIEW v_login_activity AS
SELECT
  u.id          AS user_id,
  u.email,
  u.username,
  u.role,
  COUNT(la.id) FILTER (WHERE NOT la.success
    AND la.attempted_at > NOW() - INTERVAL '15 minutes') AS recent_failures,
  MAX(la.locked_until)  AS locked_until,
  MAX(la.attempted_at)  AS last_attempt_at,
  COUNT(la.id) FILTER (WHERE la.success) AS total_successes,
  COUNT(la.id) FILTER (WHERE NOT la.success) AS total_failures
FROM users u
LEFT JOIN login_attempts la ON la.user_id = u.id
GROUP BY u.id, u.email, u.username, u.role;
`;

async function initDB() {
  const client = await pool.connect();
  try {
    console.log('Inicjalizacja bazy danych...');
    await client.query(schema);
    console.log('Schemat bazy danych utworzony pomyslnie');
    console.log('  - Rozszerzenie: pgcrypto');
    console.log('  - Funkcje: hash_password, verify_password, calculate_attempt_score');
    console.log('  - Triggery: updated_at, randomize_questions, auto_score, edit_log');
    console.log('  - Widoki: v_quiz_statistics, v_student_quiz_results, v_question_pool_stats, v_login_activity');
  } catch (err) {
    console.error('Blad inicjalizacji bazy:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

initDB();
