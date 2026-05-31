require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const pool = require('./pool');

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Seedowanie bazy danych...');
    await client.query('BEGIN');

    // Hasła hashowane przez pgcrypto (blowfish) bezpośrednio w bazie
    const admin = await client.query(
      `INSERT INTO users (email, username, first_name, last_name, password_hash, role, email_verified)
       VALUES ($1,$2,$3,$4, hash_password($5), 'admin', true)
       ON CONFLICT (email) DO NOTHING RETURNING id`,
      ['admin@pwr.edu.pl', 'admin', 'Admin', 'System', 'Admin1234!']
    );

    const instr = await client.query(
      `INSERT INTO users (email, username, first_name, last_name, password_hash, role, email_verified)
       VALUES ($1,$2,$3,$4, hash_password($5), 'instructor', true)
       ON CONFLICT (email) DO NOTHING RETURNING id`,
      ['tykierko@pwr.edu.pl', 'dr_tykierko', 'Mateusz', 'Tykierko', 'Instr1234!']
    );

    const stud = await client.query(
      `INSERT INTO users (email, username, first_name, last_name, password_hash, role, email_verified)
       VALUES ($1,$2,$3,$4, hash_password($5), 'student', true)
       ON CONFLICT (email) DO NOTHING RETURNING id`,
      ['283873@student.pwr.edu.pl', 'p_jamroziak', 'Pawel', 'Jamroziak', 'Student1234!']
    );

    const stud2 = await client.query(
      `INSERT INTO users (email, username, first_name, last_name, password_hash, role, email_verified)
       VALUES ($1,$2,$3,$4, hash_password($5), 'student', true)
       ON CONFLICT (email) DO NOTHING RETURNING id`,
      ['284000@student.pwr.edu.pl', 'a_kowalski', 'Anna', 'Kowalska', 'Student1234!']
    );

    if (!instr.rows.length || !stud.rows.length) {
      console.log('Dane juz istnieja, seed pominienty');
      await client.query('COMMIT');
      return;
    }

    const instrId = instr.rows[0].id;
    const studId  = stud.rows[0].id;
    const stud2Id = stud2.rows.length ? stud2.rows[0].id : null;

    // Grupa
    const group = await client.query(
      `INSERT INTO groups (name, instructor_id, join_code)
       VALUES ($1,$2,$3) RETURNING id`,
      ['Bazy Danych - Poniedzialek 17:05', instrId, 'BAZYD2025']
    );
    const groupId = group.rows[0].id;

    await client.query(
      `INSERT INTO group_users (group_id, user_id, status)
       VALUES ($1,$2,'accepted'), ($1,$3,'accepted')
       ON CONFLICT DO NOTHING`,
      [groupId, studId, stud2Id || studId]
    );

    // ---- BANK PYTAŃ (10 pytań do demonstracji puli) ----
    const questions = [];

    const qData = [
      { content: 'Który z poniższych typów JOIN zwraca tylko wiersze pasujące w obu tabelach?', type: 'single',
        answers: [['LEFT JOIN',false],['INNER JOIN',true],['FULL OUTER JOIN',false],['CROSS JOIN',false]] },
      { content: 'Które z poniższych są własnościami ACID? (zaznacz wszystkie poprawne)', type: 'multiple',
        answers: [['Atomicity',true],['Consistency',true],['Isolation',true],['Durability',true]] },
      { content: 'Która klauzula SQL służy do filtrowania grup po agregacji?', type: 'single',
        answers: [['WHERE',false],['HAVING',true],['GROUP BY',false],['ORDER BY',false]] },
      { content: 'Czym jest klucz obcy (FOREIGN KEY)?', type: 'single',
        answers: [['Klucz szyfrujący dane',false],['Kolumna wskazująca na klucz główny innej tabeli',true],['Indeks unikalny',false],['Klucz prywatny SSL',false]] },
      { content: 'Które polecenia należą do DDL? (zaznacz wszystkie)', type: 'multiple',
        answers: [['CREATE',true],['ALTER',true],['SELECT',false],['DROP',true],['INSERT',false]] },
      { content: 'Co robi polecenie TRUNCATE?', type: 'single',
        answers: [['Usuwa tabelę wraz ze strukturą',false],['Usuwa wszystkie wiersze bez logowania',true],['Zmienia strukturę tabeli',false],['Tworzy indeks',false]] },
      { content: 'Który poziom izolacji transakcji zapobiega "dirty reads"?', type: 'single',
        answers: [['READ UNCOMMITTED',false],['READ COMMITTED',true],['REPEATABLE READ',false],['SERIALIZABLE',false]] },
      { content: 'Które z poniższych to funkcje agregujące SQL? (zaznacz wszystkie)', type: 'multiple',
        answers: [['COUNT()',true],['SUM()',true],['MAX()',true],['UPPER()',false],['COALESCE()',false]] },
      { content: 'Czym jest normalizacja bazy danych?', type: 'single',
        answers: [['Tworzenie kopii zapasowej',false],['Proces redukcji redundancji danych',true],['Szyfrowanie tabel',false],['Optymalizacja zapytań',false]] },
      { content: 'Co oznacza skrót ORM?', type: 'single',
        answers: [['Object Relational Mapping',true],['Open Resource Manager',false],['Optimized Row Model',false],['Online Record Method',false]] },
    ];

    for (const q of qData) {
      const res = await client.query(
        `INSERT INTO question_bank (created_by, content, question_type, is_public)
         VALUES ($1,$2,$3,true) RETURNING id`,
        [instrId, q.content, q.type]
      );
      const qid = res.rows[0].id;
      questions.push(qid);

      for (const [content, is_correct] of q.answers) {
        await client.query(
          `INSERT INTO answer_options (question_id, content, is_correct) VALUES ($1,$2,$3)`,
          [qid, content, is_correct]
        );
      }
    }

    // ---- PULA PYTAŃ ----
    const pool1 = await client.query(
      `INSERT INTO question_pools (name, description, created_by)
       VALUES ($1,$2,$3) RETURNING id`,
      ['Pula: Kolokwium 1', 'Pytania z podstaw SQL i teorii baz danych', instrId]
    );
    const poolId = pool1.rows[0].id;

    for (const qid of questions) {
      await client.query(
        `INSERT INTO pool_questions (pool_id, question_id) VALUES ($1,$2)`,
        [poolId, qid]
      );
    }

    // ---- QUIZ RĘCZNY (2 pytania, stała kolejność) ----
    const quizManual = await client.query(
      `INSERT INTO quizzes (title, group_id, created_by, time_limit_sec, max_attempts, is_draft)
       VALUES ($1,$2,$3,1800,3,false) RETURNING id`,
      ['Kolokwium 1 - Podstawy SQL (manualny)', groupId, instrId]
    );
    await client.query(
      `INSERT INTO quiz_questions (quiz_id, question_id, position) VALUES ($1,$2,1),($1,$3,2)`,
      [quizManual.rows[0].id, questions[0], questions[1]]
    );

    // ---- QUIZ Z PULĄ (losuje 5 z 10 pytań, każdy student inaczej) ----
    const quizPool = await client.query(
      `INSERT INTO quizzes (title, group_id, created_by, time_limit_sec, max_attempts, is_draft,
                            question_pool_id, draw_count)
       VALUES ($1,$2,$3,2400,2,false,$4,$5) RETURNING id`,
      ['Kolokwium 1 - Losowe pytania (z puli)', groupId, instrId, poolId, 5]
    );

    await client.query('COMMIT');

    console.log('Seed zakonczony. Dane testowe:');
    console.log('  Admin:      admin@pwr.edu.pl / Admin1234!');
    console.log('  Instruktor: tykierko@pwr.edu.pl / Instr1234!');
    console.log('  Student 1:  283873@student.pwr.edu.pl / Student1234!');
    console.log('  Student 2:  284000@student.pwr.edu.pl / Student1234!');
    console.log('  Grupa:      "Bazy Danych" (kod: BAZYD2025)');
    console.log(`  Bank pytan: ${questions.length} pytan`);
    console.log(`  Pula:       "Pula: Kolokwium 1" (${questions.length} pytan)`);
    console.log('  Quiz 1:     Manualny, 2 pytania');
    console.log(`  Quiz 2:     Z puli, losuje 5 z ${questions.length}`);
    console.log('  Hasla hashowane przez pgcrypto (blowfish/bcrypt) w bazie danych');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Blad seedowania:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
