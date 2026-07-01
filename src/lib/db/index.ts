import 'server-only';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import fs from 'fs';
import path from 'path';
import * as schema from './schema';

const rawUrl = process.env.DATABASE_URL ?? 'file:./data/modelchatter.sqlite';
const filePath = rawUrl.startsWith('file:') ? rawUrl.slice(5) : rawUrl;

const dir = path.dirname(filePath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

export const sqlite = new Database(filePath);
export const db = drizzle(sqlite, { schema });
