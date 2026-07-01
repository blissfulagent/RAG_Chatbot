import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { extractText } from '../rag/extractText';
import { chunkText } from '../rag/chunk';
import { embed } from '../rag/embeddings';
import { upsertChunks, deleteDocumentChunks } from '../vector/chroma';
import {
  insertDocument,
  updateDocumentStatus,
  getDocumentById,
  deleteDocumentRow,
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

async function embedAndStoreChunks(
  documentId: string,
  filename: string,
  mimeType: string,
  chunkStrings: string[],
): Promise<void> {
  const now = Date.now();
  const chunks = await Promise.all(
    chunkStrings.map(async (content, chunkIndex) => ({
      id: `${documentId}-${chunkIndex}`,
      content,
      embedding: await embed(content),
      metadata: {
        documentId,
        filename,
        chunkIndex,
        sourceType: mimeType,
        createdAt: now,
      },
    })),
  );

  await upsertChunks(chunks);
}

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
    status: 'uploading',
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

  await updateDocumentStatus(id, 'embedding');
  try {
    await embedAndStoreChunks(id, originalName, mimeType, chunkStrings);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateDocumentStatus(id, 'failed', msg);
    throw err;
  }

  await updateDocumentStatus(id, 'ready');

  return {
    document: {
      id: doc.id,
      filename: doc.filename,
      originalName: doc.originalName,
      status: 'ready',
      chunkCount: chunkStrings.length,
    },
  };
}

export async function reembedDocument(id: string): Promise<{ embeddedChunks: number }> {
  const document = await getDocumentById(id);
  if (!document) {
    throw Object.assign(new Error('Document not found'), { status: 404 });
  }

  await updateDocumentStatus(id, 'embedding');

  try {
    const text = await extractText(document.filePath, document.mimeType);
    const chunkStrings = chunkText(text);
    await deleteDocumentChunks(id);
    await embedAndStoreChunks(id, document.originalName, document.mimeType, chunkStrings);
    await updateDocumentStatus(id, 'ready');
    return { embeddedChunks: chunkStrings.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateDocumentStatus(id, 'failed', msg);
    throw err;
  }
}

export async function deleteDocument(id: string): Promise<void> {
  const document = await getDocumentById(id);
  if (!document) {
    throw Object.assign(new Error('Document not found'), { status: 404 });
  }

  await deleteDocumentChunks(id);
  await fs.rm(document.filePath, { force: true });
  await deleteDocumentRow(id);
}
