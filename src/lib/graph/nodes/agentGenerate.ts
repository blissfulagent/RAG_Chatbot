import 'server-only'
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages'
import { getChatModel } from '../../ai/model'
import { AGENT_SYSTEM_PROMPT } from '../../ai/prompts'
import { answerFromDocumentsTool } from '../../tools/answerFromDocuments'
import type { AgentChatState } from '../agentChat.graph'
import type { Source } from '../../../types/chat'

export async function agentGenerate(
  state: AgentChatState,
): Promise<Partial<AgentChatState>> {
  const baseModel = getChatModel()
  const model = baseModel.bindTools([answerFromDocumentsTool])

  const messages = [
    new SystemMessage(AGENT_SYSTEM_PROMPT),
    ...state.history.map((entry) =>
      entry.role === 'user'
        ? new HumanMessage(entry.content)
        : new AIMessage(entry.content),
    ),
    new HumanMessage(state.userMessage),
  ]

  const firstResponse = await model.invoke(messages) as AIMessage

  if (!firstResponse.tool_calls || firstResponse.tool_calls.length === 0) {
    return {
      assistantMessage: String(firstResponse.content),
      sources: [],
      usedDocuments: false,
    }
  }

  let sources: Source[] = []
  let groundingStatus: 'supported' | 'unsupported' | 'unknown' = 'unknown'
  const toolMessages: ToolMessage[] = []

  for (const toolCall of firstResponse.tool_calls) {
    if (toolCall.name === 'answer_from_documents') {
      const rawResult = await answerFromDocumentsTool.invoke(
        toolCall.args as { question: string; topK?: number },
      )
      const resultStr = typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult)

      try {
        const parsed = JSON.parse(resultStr) as {
          answer?: string
          sources?: Source[]
          groundingStatus?: 'supported' | 'unsupported' | 'unknown'
        }
        if (Array.isArray(parsed.sources)) sources = parsed.sources
        if (parsed.groundingStatus) groundingStatus = parsed.groundingStatus
      } catch { /* keep defaults */ }

      toolMessages.push(
        new ToolMessage({
          content: resultStr,
          tool_call_id: toolCall.id ?? crypto.randomUUID(),
        }),
      )
    }
  }

  const finalMessages = [...messages, firstResponse, ...toolMessages]
  const finalResponse = await baseModel.invoke(finalMessages) as AIMessage

  return {
    assistantMessage: String(finalResponse.content),
    sources,
    groundingStatus,
    usedDocuments: true,
  }
}
