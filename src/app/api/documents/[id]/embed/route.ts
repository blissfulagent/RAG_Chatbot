export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getDocumentById, getChunksByDocumentId } from '@/lib/db/queries/documents';
import { insertEmbedding, getEmbeddedChunkIds } from '@/lib/db/queries/embeddings';
import { embed } from '@/lib/rag/embeddings';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const document = await getDocumentById(id);
  if (!document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  const model = process.env.EMBEDDING_MODEL ?? 'Xenova/all-MiniLM-L6-v2';
  const allChunks = await getChunksByDocumentId(id);
  const alreadyEmbedded = await getEmbeddedChunkIds(id, model);
  const pending = allChunks.filter((c) => !alreadyEmbedded.has(c.id));

  for (const chunk of pending) {
    const vector = await embed(chunk.content);
    await insertEmbedding({
      id: randomUUID(),
      chunkId: chunk.id,
      model,
      dimensions: vector.length,
      vectorJson: JSON.stringify(vector),
      createdAt: Date.now(),
    });
  }

  return NextResponse.json({
    ok: true,
    documentId: id,
    embeddedChunks: pending.length,
  });
}
