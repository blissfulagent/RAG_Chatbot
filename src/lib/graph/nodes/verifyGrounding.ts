import 'server-only'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { getChatModel } from '../../ai/model'
import { VERIFY_GROUNDING_PROMPT } from '../../ai/prompts'
import type { SelfRagChatState } from '../subgraphs/selfRag.graph'

export async function verifyGrounding(
  state: SelfRagChatState,
): Promise<Partial<SelfRagChatState>> {
  if (!state.assistantMessage || state.relevantChunks.length === 0) {
    return { groundingStatus: 'unsupported' }
  }

  const chunks = state.relevantChunks

  const contextText = chunks.map((c, i) => `[${i + 1}] ${c.content}`).join('\n\n')
  const userContent =
    `Answer:\n${state.assistantMessage}\n\nSource chunks:\n${contextText}`

  const model = getChatModel()
  const response = await model.invoke([
    new SystemMessage(VERIFY_GROUNDING_PROMPT),
    new HumanMessage(userContent),
  ])

  const verdict = String(response.content).trim().toLowerCase()
  const groundingStatus: 'supported' | 'unsupported' =
    verdict === 'unsupported' ? 'unsupported' : 'supported'

  return { groundingStatus }
}
