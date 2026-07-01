import 'server-only'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { getChatModel } from '../../ai/model'
import { GRADE_CHUNKS_PROMPT } from '../../ai/prompts'
import type { SelfRagChatState } from '../subgraphs/selfRag.graph'

export async function gradeRetrievedChunks(
  state: SelfRagChatState,
): Promise<Partial<SelfRagChatState>> {
  if (state.retrievedChunks.length === 0) {
    return { relevantChunks: [] }
  }

  const chunkList = state.retrievedChunks
    .map((c, i) => `[${i + 1}] ID: ${c.chunkId}\n${c.content}`)
    .join('\n\n')

  const userContent =
    `Question: ${state.userMessage}\n\nChunks:\n${chunkList}`

  const model = getChatModel()
  const response = await model.invoke([
    new SystemMessage(GRADE_CHUNKS_PROMPT),
    new HumanMessage(userContent),
  ])

  const raw = String(response.content).trim()
  let relevantChunkIds: string[] = []

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { relevantChunkIds?: unknown }
      if (Array.isArray(parsed.relevantChunkIds)) {
        relevantChunkIds = parsed.relevantChunkIds.filter(
          (id): id is string => typeof id === 'string',
        )
      }
    }
  } catch {
    relevantChunkIds = []
  }

  const relevantChunks = state.retrievedChunks.filter((c) =>
    relevantChunkIds.includes(c.chunkId),
  )

  return { relevantChunks }
}
