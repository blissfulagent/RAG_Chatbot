export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { reembedDocument } from '@/lib/services/document.service';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const result = await reembedDocument(id);
    return NextResponse.json({
      ok: true,
      documentId: id,
      embeddedChunks: result.embeddedChunks,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Re-embedding failed';
    const status = (err as { status?: number }).status ?? 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
