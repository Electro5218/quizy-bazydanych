require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const pool = require('./pool');
const bcrypt = require('bcrypt');

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 Seedowanie bazy danych...');
    await client.query('BEGIN');

    // Admin
    const adminHash = await bcrypt.hash('Admin1234!', 12);
    const admin = await client.query(
      `INSERT INTO users (email, username, first_name, last_name, password_hash, role, email_verified)
       VALUES ($1,$2,$3,$4,$5,'admin',true)
       ON CONFLICT (email) DO NOTHING RETURNING id`,
      ['admin@pwr.edu.pl', 'admin', 'Admin', 'System', adminHash]
    );

    // Instruktor
    const instrHash = await bcrypt.hash('Instr1234!', 12);
    const instr = await client.query(
      `INSERT INTO users (email, username, first_name, last_name, password_hash, role, email_verified)
       VALUES ($1,$2,$3,$4,$5,'instructor',true)
       ON CONFLICT (email) DO NOTHING RETURNING id`,
      ['tykierko@pwr.edu.pl', 'dr_tykierko', 'Mateusz', 'Tykierko', instrHash]
    );

    // Student
    const studHash = await bcrypt.hash('Student1234!', 12);
    const stud = await client.query(
      `INSERT INTO users (email, username, first_name, last_name, password_hash, role, email_verified)
       VALUES ($1,$2,$3,$4,$5,'student',true)
       ON CONFLICT (email) DO NOTHING RETURNING id`,
      ['283873@student.pwr.edu.pl', 'p_jamroziak', 'Paweł', 'Jamroziak', studHash]
    );

    if (instr.rows.length && stud.rows.length) {
      const instrId = instr.rows[0].id;
      const studId = stud.rows[0].id;

      // Grupa
      const group = await client.query(
        `INSERT INTO groups (name, instructor_id, join_code)
         VALUES ($1,$2,$3) RETURNING id`,
        ['Bazy Danych - Poniedziałek 17:05', instrId, 'BAZYD2025']
      );
      const groupId = group.rows[0].id;

      // Dodaj studenta do grupy
      await client.query(
        `INSERT INTO group_users (group_id, user_id, status)
         VALUES ($1,$2,'accepted') ON CONFLICT DO NOTHING`,
        [groupId, studId]
      );

      // Pytania w banku
      const q1 = await client.query(
        `INSERT INTO question_bank (created_by, content, question_type, is_public)
         VALUES ($1,'Który z poniższych typów JOIN zwraca tylko wiersze pasujące w obu tabelach?','single',true)
         RETURNING id`,
        [instrId]
      );
      const q2 = await client.query(
        `INSERT INTO question_bank (created_by, content, question_type, is_public)
         VALUES ($1,'Które z poniższych są własnościami ACID? (zaznacz wszystkie poprawne)','multiple',true)
         RETURNING id`,
        [instrId]
      );
      const q1id = q1.rows[0].id;
      const q2id = q2.rows[0].id;

      // Odpowiedzi do q1
      await client.query(
        `INSERT INTO answer_options (question_id, content, is_correct) VALUES
         ($1,'LEFT JOIN',false),
         ($1,'INNER JOIN',true),
         ($1,'FULL OUTER JOIN',false),
         ($1,'CROSS JOIN',false)`,
        [q1id]
      );

      // Odpowiedzi do q2
      await client.query(
        `INSERT INTO answer_options (question_id, content, is_correct) VALUES
         ($1,'Atomicity (Atomowość)',true),
         ($1,'Consistency (Spójność)',true),
         ($1,'Isolation (Izolacja)',true),
         ($1,'Durability (Trwałość)',true)`,
        [q2id]
      );

      // Quiz
      const quiz = await client.query(
        `INSERT INTO quizzes (title, group_id, created_by, time_limit_sec, max_attempts, is_draft)
         VALUES ($1,$2,$3,1800,3,false) RETURNING id`,
        ['Kolokwium 1 - Podstawy SQL', groupId, instrId]
      );
      const quizId = quiz.rows[0].id;

      // Przypisz pytania do quizu
      await client.query(
        `INSERT INTO quiz_questions (quiz_id, question_id, position) VALUES ($1,$2,1),($1,$3,2)`,
        [quizId, q1id, q2id]
      );

      console.log('✅ Seed zakończony. Dane testowe:');
      console.log('   👤 Admin:      admin@pwr.edu.pl / Admin1234!');
      console.log('   👤 Instruktor: tykierko@pwr.edu.pl / Instr1234!');
      console.log('   👤 Student:    283873@student.pwr.edu.pl / Student1234!');
      console.log(`   📚 Grupa:      "Bazy Danych - Poniedziałek 17:05" (kod: BAZYD2025)`);
    } else {
      console.log('ℹ️  Dane już istnieją, seed pominięty');
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Błąd seedowania:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
