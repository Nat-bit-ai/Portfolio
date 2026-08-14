const { Pool } = require('pg');

// Prefer a single connection string (what Neon/Supabase/Railway/Render all
// give you) over discrete PG* vars. Cloud Postgres providers require SSL;
// a plain local Postgres (PGHOST=localhost) does not, so SSL is only forced
// when it looks like a hosted connection string or the caller asks for it.
const connectionString = process.env.DATABASE_URL;

const looksHosted = connectionString && !/localhost|127\.0\.0\.1/.test(connectionString);
const wantsSsl = looksHosted || process.env.PGSSLMODE === 'require';

const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: wantsSsl ? { rejectUnauthorized: false } : undefined
    })
  : new Pool({
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT) || 5432,
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,
      ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined
    });

pool.on('error', (err) => {
  // A dropped idle connection shouldn't crash the whole process.
  console.error('Unexpected Postgres pool error:', err.message);
});

module.exports = pool;
