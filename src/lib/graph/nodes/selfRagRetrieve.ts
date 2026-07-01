import 'server-only'
import { retrieveChunks } from '../../rag/retrieve'
import { getDocumentById } from '../../db/queries/documents'
import type { Source } from '../../../types/chat'
import type { SelfRagChatState } from '../subgraphs/selfRag.graph'

export async function selfRagRetrieve(
  state: SelfRagChatState,
): Promise<Partial<SelfRagChatState>> {
  const query = state.activeQuery || state.userMessage
  const chunks = await retrieveChunks(query, state.topK)

  const uniqueDocIds = [...new Set(chunks.map((c) => c.documentId))]
  const docMap = new Map<string, string>()
  await Promise.all(
    uniqueDocIds.map(async (docId) => {
      const doc = await getDocumentById(docId)
      if (doc) docMap.set(docId, doc.originalName)
    }),
  )

  const sources: Source[] = chunks.map((c) => ({
    chunkId: c.chunkId,
    documentId: c.documentId,
    filename: docMap.get(c.documentId) ?? c.documentId,
    score: c.score,
    contentPreview: c.content.slice(0, 200),
  }))

  return { retrievedChunks: chunks, sources }
}
