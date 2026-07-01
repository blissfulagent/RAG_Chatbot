import 'server-only';
import { desc, eq } from 'drizzle-orm';
import { db } from '../index';
import { conversations } from '../schema';

export function createConversation(id: string, title: string) {
  const now = Date.now();
  return db.insert(conversations).values({ id, title, createdAt: now, updatedAt: now }).run();
}

export function getConversationById(id: string) {
  return db.select().from(conversations).where(eq(conversations.id, id)).get();
}

export function listConversations() {
  return db.select().from(conversations).orderBy(desc(conversations.updatedAt)).all();
}
