import 'server-only'
import { createConversation, getConversationById } from '../../db/queries/conversations'
import { getMessagesByConversationId } from '../../db/queries/messages'
import type { BaseChatState } from '../state'

export async function loadConversation(
  state: BaseChatState,
): Promise<Partial<BaseChatState>> {
  if (state.conversationId) {
    const conversation = getConversationById(state.conversationId)
    if (!conversation) {
      throw new Error(`CONVERSATION_NOT_FOUND:${state.conversationId}`)
    }
    const rows = getMessagesByConversationId(state.conversationId)
    const history = rows.map((row) => ({
      role: row.role as 'user' | 'assistant',
      content: row.content,
    }))
    return { history }
  }

  const id = crypto.randomUUID()
  const title = state.userMessage.trim().slice(0, 60) || 'New Conversation'
  createConversation(id, title)
  return { conversationId: id, history: [] }
}
