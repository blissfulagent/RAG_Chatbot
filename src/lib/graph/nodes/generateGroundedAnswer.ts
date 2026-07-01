import 'server-only'
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages'
import { getChatModel } from '../../ai/model'
import { GROUNDED_ANSWER_PROMPT } from '../../ai/prompts'
import type { SelfRagChatState } from '../subgraphs/selfRag.graph'

const NO_CONTEXT_REPLY =
  'The documents do not contain enough information to answer this question.'

export async function generateGroundedAnswer(
  state: SelfRagChatState,
): Promise<Partial<SelfRagChatState>> {
  const chunks = state.relevantChunks

  if (chunks.length === 0) {
    return { assistantMessage: NO_CONTEXT_REPLY, groundingStatus: 'unsupported' }
  }

  const context = chunks.map((c, i) => `[${i + 1}] ${c.content}`).join('\n\n')
  const systemWithContext = `${GROUNDED_ANSWER_PROMPT}\n\nContext:\n${context}`

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
