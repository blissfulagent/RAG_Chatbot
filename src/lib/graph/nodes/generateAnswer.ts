import 'server-only'
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages'
import { getChatModel } from '../../ai/model'
import { SYSTEM_PROMPT } from '../../ai/prompts'
import type { ChatGraphState } from '../state'

export async function generateAnswer(
  state: ChatGraphState,
): Promise<Partial<ChatGraphState>> {
  const model = getChatModel()

  const messages = [
    new SystemMessage(SYSTEM_PROMPT),
    ...state.history.map((entry) =>
      entry.role === 'user'
        ? new HumanMessage(entry.content)
        : new AIMessage(entry.content),
    ),
    new HumanMessage(state.userMessage),
  ]

  const response = await model.invoke(messages)
  const assistantMessage = String(response.content)

  return { assistantMessage }
}
