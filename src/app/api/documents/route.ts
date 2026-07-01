export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { ingestDocument } from '@/lib/services/document.service';
import { listDocuments } from '@/lib/db/queries/documents';
import { ALLOWED_DOCUMENT_TYPES, MAX_DOCUMENT_SIZE_BYTES } from '@/lib/constants/documents';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const mimeType = file.type;
  if (!ALLOWED_DOCUMENT_TYPES.has(mimeType)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${mimeType}. Allowed: pdf, txt, md` },
      { status: 400 },
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.byteLength > MAX_DOCUMENT_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'File exceeds 10 MB limit' },
      { status: 400 },
    );
  }

  try {
    const result = await ingestDocument(file.name, mimeType, buffer);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Ingestion failed';
    const status = (err as { status?: number }).status ?? 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function GET() {
  const docs = await listDocuments();
  return NextResponse.json({ documents: docs });
}
