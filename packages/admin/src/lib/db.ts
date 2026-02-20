import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import * as schema from './schema';

neonConfig.webSocketConstructor = ws;

function getDatabaseUrl(): string {
  let url: string | undefined;
  
  // Try import.meta.env first (for Astro/browser context)
  try {
    url = (import.meta.env as any)?.DATABASE_URL;
  } catch {
    // import.meta might not be available in Node scripts
  }
  
  // Fall back to process.env (for Node scripts)
  url = url || process.env.DATABASE_URL;
  
  if (!url) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  return url;
}

let _pool: Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;
let _schemaReady: Promise<void> | null = null;

function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({ connectionString: getDatabaseUrl() });
  }
  return _pool;
}

async function ensureDbSchema(): Promise<void> {
  if (_schemaReady) {
    return _schemaReady;
  }

  _schemaReady = (async () => {
    const pool = getPool();

    await pool.query(`
      create table if not exists users (
        id serial primary key,
        email text not null unique,
        password_hash text not null,
        username text,
        created_at timestamp not null default now(),
        updated_at timestamp not null default now()
      );
    `);

    await pool.query(`
      create table if not exists sessions (
        id text primary key,
        user_id integer not null references users(id) on delete cascade,
        expires_at timestamp not null,
        created_at timestamp not null default now()
      );
    `);

    await pool.query(`
      create index if not exists sessions_user_id_idx on sessions(user_id);
    `);
  })().catch((error) => {
    _schemaReady = null;
    throw error;
  });

  return _schemaReady;
}

export function getDb() {
  if (!_db) {
    _db = drizzle(getPool(), { schema });
  }
  return _db;
}

export async function getDbWithSchema() {
  await ensureDbSchema();
  return getDb();
}

export { schema };
