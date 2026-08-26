import fs from 'node:fs';
import path from 'node:path';

import { pool, closePool, describeConnection } from './pool';


const MIGRATIONS_DIR = path.resolve(__dirname, '../../db/migrations');

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function appliedMigrations(): Promise<Set<string>> {
  const result = await pool.query<{ filename: string }>(
    'SELECT filename FROM schema_migrations',
  );
  return new Set(result.rows.map((row) => row.filename));
}

async function migrate(): Promise<void> {
  console.log(`[migrate] Base cible : ${describeConnection()}`);

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Dossier de migrations introuvable : ${MIGRATIONS_DIR}`);
  }

  await ensureMigrationsTable();
  const already = await appliedMigrations();

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('[migrate] Aucun fichier de migration trouvé.');
    return;
  }

  let appliedCount = 0;

  for (const file of files) {
    if (already.has(file)) {
      console.log(`[migrate] ⇢ ${file} — déjà appliquée, ignorée.`);
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      appliedCount += 1;
      console.log(`[migrate] ✔ ${file} — appliquée.`);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw new Error(
        `Échec de la migration ${file} : ${error instanceof Error ? error.message : error}`,
      );
    } finally {
      client.release();
    }
  }

  console.log(
    appliedCount === 0
      ? '[migrate] Schéma déjà à jour.'
      : `[migrate] ${appliedCount} migration(s) appliquée(s).`,
  );
}

migrate()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error('[migrate] Échec :', error instanceof Error ? error.message : error);
    await closePool().catch(() => undefined);
    process.exit(1);
  });
