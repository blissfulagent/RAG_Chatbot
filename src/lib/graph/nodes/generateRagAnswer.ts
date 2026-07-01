import 'server-only'
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages'
import { getChatModel } from '../../ai/model'
import { RAG_SYSTEM_PROMPT } from '../../ai/prompts'
import type { RagGraphState } from '../rag.graph'

const NO_CONTEXT_REPLY =
  'The documents do not contain enough information to answer this question.'

export async function generateRagAnswer(
  state: RagGraphState,
): Promise<Partial<RagGraphState>> {
  if (state.retrievedChunks.length === 0) {
    return { assistantMessage: NO_CONTEXT_REPLY }
  }

  const context = state.retrievedChunks
    .map((c, i) => `[${i + 1}] ${c.content}`)
    .join('\n\n')

  const systemWithContext = `${RAG_SYSTEM_PROMPT}\n\nContext:\n${context}`

  const model = getChatModel()
  const messages = [
    new SystemMessage(systemWithContext),
    ...state.history.map((entry) =>
      entry.role === 'user'
        ? new HumanMessage(entry.content)
        : new AIMessage(entry.content),
    ),
    new HumanMessage(state.userMessage),
  ]

  const response = await model.invoke(messages)
  return { assistantMessage: String(response.content) }
}
