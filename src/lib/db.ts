import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import path from 'path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema-drizzle';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'sqlite.db');

let db: Database.Database | null = null;
let drizzleDb: ReturnType<typeof drizzle> | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
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
