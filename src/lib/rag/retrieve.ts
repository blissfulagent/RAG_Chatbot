import 'server-only'
import { embed } from './embeddings'
import { queryChunks } from '../vector/chroma'
import type { RetrievedChunk } from '../../types/chat'

// ChromaDB is the active vector store — see src/lib/vector/chroma.ts.
export async function retrieveChunks(query: string, topK: number): Promise<RetrievedChunk[]> {
  const queryVector = await embed(query)
  return queryChunks(queryVector, topK)
}
