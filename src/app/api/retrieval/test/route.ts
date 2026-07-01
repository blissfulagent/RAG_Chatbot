export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { embed } from '@/lib/rag/embeddings';
import { cosineSimilarity } from '@/lib/rag/similarity';
import { getAllEmbeddingsWithChunks } from '@/lib/db/queries/embeddings';

const bodySchema = z.object({
  query: z.string().min(1),
  topK: z.number().int().positive().optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const defaultTopK = parseInt(process.env.RETRIEVAL_TOP_K ?? '5', 10);
  const { query, topK = defaultTopK } = parsed.data;

  const queryVector = await embed(query);
  const rows = await getAllEmbeddingsWithChunks();

  const scored = rows.map((row) => {
    const vec = JSON.parse(row.vectorJson) as number[];
    return {
      chunkId: row.chunkId,
      documentId: row.documentId,
      score: cosineSimilarity(queryVector, vec),
      content: row.content,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const results = scored.slice(0, topK);

  return NextResponse.json({ results });
}
