import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { extractText } from '../rag/extractText';
import { chunkText } from '../rag/chunk';
import {
  insertDocument,
  insertChunks,
  updateDocumentStatus,
} from '../db/queries/documents';
import { ALLOWED_DOCUMENT_TYPES, MAX_DOCUMENT_SIZE_BYTES } from '../constants/documents';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

export type IngestResult = {
  document: {
    id: string;
    filename: string;
    originalName: string;
    status: string;
    chunkCount: number;
  };
};

export async function ingestDocument(
  originalName: string,
  mimeType: string,
  buffer: Buffer,
): Promise<IngestResult> {
  if (!ALLOWED_DOCUMENT_TYPES.has(mimeType)) {
    throw Object.assign(new Error(`Unsupported file type: ${mimeType}`), { status: 400 });
  }
  if (buffer.byteLength > MAX_DOCUMENT_SIZE_BYTES) {
    throw Object.assign(new Error('File exceeds 10 MB limit'), { status: 400 });
  }

  await fs.mkdir(UPLOADS_DIR, { recursive: true });

  const id = randomUUID();
  const sanitized = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filename = `${id}-${sanitized}`;
  const filePath = path.join(UPLOADS_DIR, filename);

  await fs.writeFile(filePath, buffer);

  const now = Date.now();
  const doc = await insertDocument({
    id,
    filename,
    originalName,
    mimeType,
    filePath,
    status: 'processing',
    error: null,
    createdAt: now,
    updatedAt: now,
  });

  let text: string;
  try {
    text = await extractText(filePath, mimeType);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateDocumentStatus(id, 'failed', msg);
    throw err;
  }

  const chunkStrings = chunkText(text);
  const chunkNow = Date.now();
  const chunkRows = chunkStrings.map((content, idx) => ({
    id: randomUUID(),
    documentId: id,
    chunkIndex: idx,
    content,
    tokenCount: Math.ceil(content.length / 4),
    metadataJson: null,
    createdAt: chunkNow,
  }));

  await insertChunks(chunkRows);
  await updateDocumentStatus(id, 'ready');

  return {
    document: {
      id: doc.id,
      filename: doc.filename,
      originalName: doc.originalName,
      status: 'ready',
      chunkCount: chunkRows.length,
    },
  };
}
