import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '../index';
import { documents } from '../schema';

type DocumentInsert = typeof documents.$inferInsert;

export async function insertDocument(data: DocumentInsert) {
  const [row] = await db.insert(documents).values(data).returning();
  return row;
}

export async function updateDocumentStatus(
  id: string,
  status: string,
  error?: string,
) {
  await db
    .update(documents)
    .set({ status, error: error ?? null, updatedAt: Date.now() })
    .where(eq(documents.id, id));
}

export async function listDocuments() {
  return db.select().from(documents).orderBy(documents.createdAt);
}

export async function getDocumentById(id: string) {
  const [row] = await db.select().from(documents).where(eq(documents.id, id));
  return row ?? null;
}

export async function deleteDocumentRow(id: string) {
  await db.delete(documents).where(eq(documents.id, id));
}
