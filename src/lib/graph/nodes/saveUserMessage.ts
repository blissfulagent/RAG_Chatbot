import 'server-only'
import { insertMessage } from '../../db/queries/messages'
import type { BaseChatState } from '../state'

export async function saveUserMessage(
  state: BaseChatState,
): Promise<Partial<BaseChatState>> {
  insertMessage({
    id: crypto.randomUUID(),
    conversationId: state.conversationId!,
    role: 'user',
    content: state.userMessage,
  })
  return {}
}
