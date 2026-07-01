import 'server-only'
import { embed } from './embeddings'
import { cosineSimilarity } from './similarity'
import { getAllEmbeddingsWithChunks } from '../db/queries/embeddings'
import type { RetrievedChunk } from '../../types/chat'

export async function retrieveChunks(query: string, topK: number): Promise<RetrievedChunk[]> {
  const queryVector = await embed(query)
  const rows = await getAllEmbeddingsWithChunks()

  const scored = rows.map((row) => {
    const vec = JSON.parse(row.vectorJson) as number[]
    return {
      chunkId: row.chunkId,
      documentId: row.documentId,
      content: row.content,
      score: cosineSimilarity(queryVector, vec),
    }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, topK)
}
