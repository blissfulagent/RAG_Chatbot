import 'server-only'
import { insertMessage } from '../../db/queries/messages'
import type { AgentChatState } from '../agentChat.graph'

export async function saveAgentAssistantMessage(
  state: AgentChatState,
): Promise<Partial<AgentChatState>> {
  insertMessage({
    id: crypto.randomUUID(),
    conversationId: state.conversationId!,
    role: 'assistant',
    content: state.assistantMessage!,
    metadataJson: state.usedDocuments
      ? JSON.stringify({ sources: state.sources, groundingStatus: state.groundingStatus })
      : undefined,
  })
  return {}
}
