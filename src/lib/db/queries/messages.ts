import 'server-only';
import { asc, eq } from 'drizzle-orm';
import { db } from '../index';
import { messages } from '../schema';

export interface NewMessage {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  metadataJson?: string;
}

export function insertMessage(msg: NewMessage) {
  return db
    .insert(messages)
    .values({ ...msg, createdAt: Date.now() })
    .run();
}

export function getMessagesByConversationId(conversationId: string) {
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt))
    .all();
}
