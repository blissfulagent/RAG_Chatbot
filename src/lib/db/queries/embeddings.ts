import 'server-only';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../index';
import { chunks, embeddings } from '../schema';

type EmbeddingInsert = typeof embeddings.$inferInsert;

export async function insertEmbedding(data: EmbeddingInsert) {
  await db.insert(embeddings).values(data).onConflictDoNothing();
}

export async function getEmbeddedChunkIds(
  documentId: string,
  model: string,
): Promise<Set<string>> {
  const docChunks = await db
    .select({ id: chunks.id })
    .from(chunks)
    .where(eq(chunks.documentId, documentId));

  if (docChunks.length === 0) return new Set();

  const chunkIds = docChunks.map((c) => c.id);
  const rows = await db
    .select({ chunkId: embeddings.chunkId })
    .from(embeddings)
    .where(and(inArray(embeddings.chunkId, chunkIds), eq(embeddings.model, model)));

  return new Set(rows.map((r) => r.chunkId));
}

export async function getAllEmbeddingsWithChunks() {
  return db
    .select({
      embeddingId: embeddings.id,
      chunkId: embeddings.chunkId,
      documentId: chunks.documentId,
      content: chunks.content,
      vectorJson: embeddings.vectorJson,
      model: embeddings.model,
    })
    .from(embeddings)
    .innerJoin(chunks, eq(embeddings.chunkId, chunks.id));
}
