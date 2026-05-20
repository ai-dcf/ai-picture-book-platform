import Database from 'better-sqlite3';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './db/schema-drizzle';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'sqlite.db');

// Ensure database directory exists
function ensureDbDir() {
  if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true });
  }
}

let db: Database.Database | null = null;
let drizzleDb: ReturnType<typeof drizzle> | null = null;

export function getDb(): Database.Database {
  if (!db) {
    ensureDbDir();
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initDatabase();
  }
  return db;
}

export function getDrizzleDb() {
  if (!drizzleDb) {
    const database = getDb();
    drizzleDb = drizzle(database, { schema });
  }
  return drizzleDb;
}

export function initDatabase(): void {
  const database = getDb();
  const schemaPath = path.join(process.cwd(), 'src', 'lib', 'db', 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');

  database.exec(schema);
  runMigrations(database);
}

const MIGRATIONS: Array<{ column: string; table: string; type: string; default: string }> = [
  { column: 'image_refs', table: 'pages', type: 'TEXT', default: "'[]'" },
];

function runMigrations(database: Database.Database): void {
  for (const migration of MIGRATIONS) {
    try {
      const rows = database.prepare(`PRAGMA table_info(${migration.table})`).all() as Array<{ name: string }>;
      const exists = rows.some(row => row.name === migration.column);
      if (!exists) {
        database.exec(
          `ALTER TABLE ${migration.table} ADD COLUMN ${migration.column} ${migration.type} NOT NULL DEFAULT ${migration.default}`
        );
      }
    } catch {
      // Column may already exist from schema.sql CREATE TABLE
    }
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    drizzleDb = null;
  }
}

export function withTransaction<T>(
  fn: () => T
): T {
  const database = getDb();
  const transactionFn = database.transaction(fn);
  return transactionFn();
}
