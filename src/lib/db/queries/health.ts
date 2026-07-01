import 'server-only';
import { db } from '../index';
import { conversations } from '../schema';

export function dbHealthCheck(): { ok: boolean; database: string } {
  try {
    db.select().from(conversations).limit(1).all();
    return { ok: true, database: 'connected' };
  } catch (err) {
    return { ok: false, database: String(err) };
  }
}
