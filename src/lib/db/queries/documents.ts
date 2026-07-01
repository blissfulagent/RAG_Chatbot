import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '../index';
import { chunks, documents } from '../schema';

type DocumentInsert = typeof documents.$inferInsert;
type ChunkInsert = typeof chunks.$inferInsert;

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

export async function insertChunks(rows: ChunkInsert[]) {
  if (rows.length === 0) return;
  await db.insert(chunks).values(rows);
}

export async function listDocuments() {
  return db.select().from(documents).orderBy(documents.createdAt);
}

export async function getDocumentById(id: string) {
  const [row] = await db.select().from(documents).where(eq(documents.id, id));
  return row ?? null;
}

export async function getChunksByDocumentId(documentId: string) {
  return db
    .select()
    .from(chunks)
    .where(eq(chunks.documentId, documentId))
    .orderBy(chunks.chunkIndex);
}
