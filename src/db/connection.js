import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const DEFAULT_DB_PATH = fileURLToPath(new URL('../../data/capstone.sqlite', import.meta.url));

export function openDatabase(databasePath = DEFAULT_DB_PATH) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  database.exec('PRAGMA foreign_keys = ON');

  const schemaPath = fileURLToPath(new URL('./schema.sql', import.meta.url));
  database.exec(fs.readFileSync(schemaPath, 'utf8'));
  return database;
}
