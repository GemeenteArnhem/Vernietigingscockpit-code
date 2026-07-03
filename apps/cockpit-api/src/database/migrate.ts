import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    database: process.env.POSTGRES_DB ?? 'vernietigingscockpit',
    user: process.env.POSTGRES_USER ?? 'postgres',
    password: process.env.POSTGRES_PASSWORD ?? 'postgres',
  });

  const migrationsDir = join(process.cwd(), 'src', 'database', 'migrations');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();

  for (const file of files) {
    const applied = await pool.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [file]);

    if (applied.rowCount) {
      continue;
    }

    const sql = await readFile(join(migrationsDir, file), 'utf8');

    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await pool.query('COMMIT');
      console.log(`Applied ${file}`);
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  }

  await pool.end();
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
