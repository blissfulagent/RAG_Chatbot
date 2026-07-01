export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { retrieveChunks } from '@/lib/rag/retrieve';

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

  const results = await retrieveChunks(query, topK);

  return NextResponse.json({ results });
}
