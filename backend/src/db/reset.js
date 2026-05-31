require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const pool = require('./pool');

// Usuwa WSZYSTKIE dane (tabele, funkcje, triggery, widoki) i tworzy schemat od nowa.
// Uruchom: npm run db:reset
async function reset() {
  const client = await pool.connect();
  try {
    console.log('Resetowanie bazy danych...');
    await client.query(`
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO postgres;
      GRANT ALL ON SCHEMA public TO public;
    `);
    console.log('Schemat wyczyszczony. Uruchom teraz: npm run db:init && npm run db:seed');
  } catch (err) {
    console.error('Blad resetu:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

reset();
