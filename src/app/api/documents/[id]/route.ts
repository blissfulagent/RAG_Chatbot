export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getDocumentById, getChunksByDocumentId } from '@/lib/db/queries/documents';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const document = await getDocumentById(id);
  if (!document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }
  const chunks = await getChunksByDocumentId(id);
  return NextResponse.json({ document, chunks });
}
