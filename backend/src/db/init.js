require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const pool = require('./pool');

const schema = `
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
-- TABELA: users (centralna tabela użytkowników)
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
  created_at     TIMESTAMP    DEFAULT NOW(),
  updated_at     TIMESTAMP    DEFAULT NOW()
);

-- ============================================================
-- TABELA: email_verification_tokens
-- ============================================================
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  expires_at TIMESTAMP NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
  is_used    BOOLEAN DEFAULT false
);

-- ============================================================
-- TABELA: password_reset_tokens (tokeny resetu hasła, 15 min)
-- ============================================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  expires_at TIMESTAMP NOT NULL DEFAULT NOW() + INTERVAL '15 minutes',
  is_used    BOOLEAN DEFAULT false
);

-- ============================================================
-- TABELA: login_attempts (blokada po 5 nieudanych próbach)
-- ============================================================
CREATE TABLE IF NOT EXISTS login_attempts (
  id           SERIAL PRIMARY KEY,
  user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attempted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  success      BOOLEAN NOT NULL,
  locked_until TIMESTAMP
);

-- ============================================================
-- TABELA: groups (grupy tworzone przez instruktorów)
-- ============================================================
CREATE TABLE IF NOT EXISTS groups (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(200) NOT NULL,
  instructor_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  join_code     VARCHAR(20) NOT NULL UNIQUE,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TABELA: group_users (N:M users <-> groups)
-- ============================================================
CREATE TABLE IF NOT EXISTS group_users (
  group_id  INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status    enum_group_status NOT NULL DEFAULT 'pending',
  joined_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

-- ============================================================
-- TABELA: question_bank (bank pytań instruktora)
-- ============================================================
CREATE TABLE IF NOT EXISTS question_bank (
  id            SERIAL PRIMARY KEY,
  created_by    INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  content       TEXT NOT NULL,
  latex_content TEXT,
  question_type enum_question_type NOT NULL DEFAULT 'single',
  is_public     BOOLEAN DEFAULT false,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TABELA: quizzes (quizy przypisane do grup)
-- ============================================================
CREATE TABLE IF NOT EXISTS quizzes (
  id            SERIAL PRIMARY KEY,
  title         VARCHAR(300) NOT NULL,
  group_id      INT REFERENCES groups(id) ON DELETE SET NULL,
  created_by    INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  time_limit_sec INT,
  max_attempts  INT NOT NULL DEFAULT 1,
  is_draft      BOOLEAN DEFAULT true,
  visible_from  TIMESTAMP,
  visible_until TIMESTAMP,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TABELA: quiz_visibility (widoczność quizu per grupa/user)
-- ============================================================
CREATE TABLE IF NOT EXISTS quiz_visibility (
  id          SERIAL PRIMARY KEY,
  quiz_id     INT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  target_type enum_visibility_target NOT NULL,
  target_id   INT NOT NULL
);

-- ============================================================
-- TABELA: quiz_questions (pytania przypisane do quizu)
-- ============================================================
CREATE TABLE IF NOT EXISTS quiz_questions (
  quiz_id     INT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_id INT NOT NULL REFERENCES question_bank(id) ON DELETE RESTRICT,
  position    INT NOT NULL DEFAULT 0,
  PRIMARY KEY (quiz_id, question_id)
);

-- ============================================================
-- TABELA: answer_options (opcje odpowiedzi do pytań)
-- ============================================================
CREATE TABLE IF NOT EXISTS answer_options (
  id            SERIAL PRIMARY KEY,
  question_id   INT NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  latex_content TEXT,
  is_correct    BOOLEAN NOT NULL DEFAULT false
);

-- ============================================================
-- TABELA: quiz_attempts (podejścia studenta do quizu)
-- ============================================================
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  quiz_id    INT NOT NULL REFERENCES quizzes(id) ON DELETE RESTRICT,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMP,
  score      INT,
  status     enum_attempt_status NOT NULL DEFAULT 'in_progress'
);

-- ============================================================
-- TABELA: user_answers (odpowiedzi udzielone w podejściu)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_answers (
  attempt_id  INT NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id INT NOT NULL REFERENCES question_bank(id) ON DELETE RESTRICT,
  answer_id   INT NOT NULL REFERENCES answer_options(id) ON DELETE RESTRICT,
  answered_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (attempt_id, question_id, answer_id)
);

-- ============================================================
-- TABELA: quiz_edit_history (historia zmian quizu)
-- ============================================================
CREATE TABLE IF NOT EXISTS quiz_edit_history (
  id             SERIAL PRIMARY KEY,
  quiz_id        INT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  edited_by      INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  edited_at      TIMESTAMP DEFAULT NOW(),
  change_summary TEXT
);

-- ============================================================
-- INDEKSY (zgodnie z prezentacją)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_email            ON users(email);
CREATE INDEX IF NOT EXISTS idx_group_users_user       ON group_users(user_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_group          ON quizzes(group_id);
CREATE INDEX IF NOT EXISTS idx_questions_quiz         ON quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_answers_question       ON answer_options(question_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user_quiz     ON quiz_attempts(user_id, quiz_id);
CREATE INDEX IF NOT EXISTS idx_user_answers_attempt   ON user_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_reset_token            ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_login_attempts_user    ON login_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verify_token     ON email_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_quiz_visibility_quiz   ON quiz_visibility(quiz_id);
`;

async function initDB() {
  const client = await pool.connect();
  try {
    console.log('🔧 Inicjalizacja bazy danych...');
    await client.query(schema);
    console.log('✅ Schemat bazy danych utworzony pomyślnie');
  } catch (err) {
    console.error('❌ Błąd inicjalizacji bazy:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

initDB();
