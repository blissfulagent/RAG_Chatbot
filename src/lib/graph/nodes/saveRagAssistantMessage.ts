import 'server-only'
import { insertMessage } from '../../db/queries/messages'
import type { BaseChatState } from '../state'
import type { Source } from '../../../types/chat'

interface RagAssistantState extends BaseChatState {
  sources: Source[]
}

export async function saveRagAssistantMessage(
  state: RagAssistantState,
): Promise<Partial<RagAssistantState>> {
  insertMessage({
    id: crypto.randomUUID(),
    conversationId: state.conversationId!,
    role: 'assistant',
    content: state.assistantMessage!,
    metadataJson: JSON.stringify({ sources: state.sources }),
  })
  return {}
}
