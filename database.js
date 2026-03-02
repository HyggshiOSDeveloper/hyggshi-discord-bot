const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDatabase() {

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bans (
      userId TEXT,
      guildId TEXT,
      reason TEXT,
      expiresAt BIGINT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS warns (
      id SERIAL PRIMARY KEY,
      userId TEXT,
      guildId TEXT,
      moderatorId TEXT,
      reason TEXT,
      timestamp BIGINT
    );
  `);

  console.log("✅ Database ready");
}

module.exports = { pool, initDatabase };
