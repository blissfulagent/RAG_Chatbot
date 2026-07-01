import 'server-only';
import { ChromaClient, type Collection } from 'chromadb';
import type { RetrievedChunk } from '../../types/chat';

// ChromaDB is the active vector store for document chunks + embeddings.
// SQLite no longer stores chunk content or embeddings for retrieval.

export type ChromaChunkMetadata = {
  documentId: string;
  filename: string;
  chunkIndex: number;
  sourceType: string;
  createdAt: number;
};

export type ChromaChunkInput = {
  id: string;
  content: string;
  embedding: number[];
  metadata: ChromaChunkMetadata;
};

const COLLECTION_NAME = process.env.CHROMA_COLLECTION ?? 'modelchatter_documents';

function parseChromaUrl(url: string): { host: string; port: number; ssl: boolean } {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port, 10) : 8000,
    ssl: parsed.protocol === 'https:',
  };
}

let _client: ChromaClient | null = null;
let _collection: Collection | null = null;

function getClient(): ChromaClient {
  if (!_client) {
    const { host, port, ssl } = parseChromaUrl(process.env.CHROMA_URL ?? 'http://localhost:8000');
    _client = new ChromaClient({ host, port, ssl });
  }
  return _client;
}

async function getCollection(): Promise<Collection> {
  if (!_collection) {
    _collection = await getClient().getOrCreateCollection({
      name: COLLECTION_NAME,
      embeddingFunction: null,
      configuration: { hnsw: { space: 'cosine' } },
    });
  }
  return _collection;
}

export async function upsertChunks(chunks: ChromaChunkInput[]): Promise<void> {
  if (chunks.length === 0) return;
  const collection = await getCollection();
  await collection.upsert({
    ids: chunks.map((c) => c.id),
    embeddings: chunks.map((c) => c.embedding),
    documents: chunks.map((c) => c.content),
    metadatas: chunks.map((c) => c.metadata),
  });
}

export async function queryChunks(queryEmbedding: number[], topK: number): Promise<RetrievedChunk[]> {
  const collection = await getCollection();
  const result = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: topK,
  });

  const ids = result.ids[0] ?? [];
  const documents = result.documents[0] ?? [];
  const distances = result.distances[0] ?? [];
  const metadatas = result.metadatas[0] ?? [];

  return ids.map((id, i) => {
    const metadata = metadatas[i] as ChromaChunkMetadata | null;
    const distance = distances[i];
    return {
      chunkId: id,
      documentId: metadata?.documentId ?? '',
      content: documents[i] ?? '',
      score: distance == null ? 0 : 1 - distance,
    };
  });
}

export async function getChunksForDocument(documentId: string): Promise<RetrievedChunk[]> {
  const collection = await getCollection();
  const result = await collection.get({
    where: { documentId },
    include: ['documents', 'metadatas'],
  });

  return result.ids.map((id, i) => {
    const metadata = result.metadatas[i] as ChromaChunkMetadata | null;
    return {
      chunkId: id,
      documentId: metadata?.documentId ?? documentId,
      content: result.documents[i] ?? '',
      score: 1,
    };
  });
}

export async function deleteDocumentChunks(documentId: string): Promise<void> {
  const collection = await getCollection();
  await collection.delete({ where: { documentId } });
}
