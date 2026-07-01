import 'server-only'
import { insertMessage } from '../../db/queries/messages'
import type { BaseChatState } from '../state'

export async function saveAssistantMessage(
  state: BaseChatState,
): Promise<Partial<BaseChatState>> {
  insertMessage({
    id: crypto.randomUUID(),
    conversationId: state.conversationId!,
    role: 'assistant',
    content: state.assistantMessage!,
  })
  return {}
}
