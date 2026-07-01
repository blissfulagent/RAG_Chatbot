import 'server-only'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { getChatModel } from '../../ai/model'
import { REWRITE_QUERY_PROMPT } from '../../ai/prompts'
import type { SelfRagChatState } from '../subgraphs/selfRag.graph'

export async function rewriteRagQuery(
  state: SelfRagChatState,
): Promise<Partial<SelfRagChatState>> {
  const contextSample = state.retrievedChunks
    .slice(0, 3)
    .map((c) => c.content.slice(0, 150))
    .join('\n---\n')

  const userContent =
    `Original question: ${state.userMessage}\n\nWeak retrieved context:\n${contextSample}`

  const model = getChatModel()
  const response = await model.invoke([
    new SystemMessage(REWRITE_QUERY_PROMPT),
    new HumanMessage(userContent),
  ])

  const rewritten = String(response.content).trim()

  return {
    activeQuery: rewritten,
    retryCount: state.retryCount + 1,
  }
}
