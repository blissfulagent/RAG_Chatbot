import { Annotation, END, START, StateGraph } from '@langchain/langgraph'
import type { RunnableConfig } from '@langchain/core/runnables'
import type { Source } from '../../types/chat'
import { loadConversation } from './nodes/loadConversation'
import { saveUserMessage } from './nodes/saveUserMessage'
import { agentGenerate } from './nodes/agentGenerate'
import { saveAgentAssistantMessage } from './nodes/saveAgentAssistantMessage'
import { withTrace } from '../observability/trace'

export const AgentChatAnnotation = Annotation.Root({
  conversationId: Annotation<string | undefined>({
    default: () => undefined,
    reducer: (_, b) => b,
  }),
  userMessage: Annotation<string>({
    default: () => '',
    reducer: (_, b) => b,
  }),
  history: Annotation<Array<{ role: 'user' | 'assistant'; content: string }>>({
    default: () => [],
    reducer: (_, b) => b,
  }),
  assistantMessage: Annotation<string | undefined>({
    default: () => undefined,
    reducer: (_, b) => b,
  }),
  sources: Annotation<Source[]>({
    default: () => [],
    reducer: (_, b) => b,
  }),
  groundingStatus: Annotation<'supported' | 'unsupported' | 'unknown' | undefined>({
    default: () => undefined,
    reducer: (_, b) => b,
  }),
  usedDocuments: Annotation<boolean>({
    default: () => false,
    reducer: (_, b) => b,
  }),
})

export type AgentChatState = typeof AgentChatAnnotation.State

function runId(config?: RunnableConfig): string | undefined {
  return config?.configurable?.runId as string | undefined
}

const graph = new StateGraph(AgentChatAnnotation)
  .addNode('loadConversation', async (state: AgentChatState, config?: RunnableConfig) =>
    withTrace(runId(config), 'loadConversation', 'node',
      () => loadConversation(state),
      { conversationId: state.conversationId }),
  )
  .addNode('saveUserMessage', async (state: AgentChatState, config?: RunnableConfig) =>
    withTrace(runId(config), 'saveUserMessage', 'node',
      () => saveUserMessage(state),
      { conversationId: state.conversationId, role: 'user' }),
  )
  .addNode('agentGenerate', async (state: AgentChatState, config?: RunnableConfig) =>
    withTrace(runId(config), 'agentGenerate', 'node',
      () => agentGenerate(state),
      { messageCount: state.history.length }),
  )
  .addNode('saveAgentAssistantMessage', async (state: AgentChatState, config?: RunnableConfig) =>
    withTrace(runId(config), 'saveAgentAssistantMessage', 'node',
      () => saveAgentAssistantMessage(state),
      { conversationId: state.conversationId }),
  )
  .addEdge(START, 'loadConversation')
  .addEdge('loadConversation', 'saveUserMessage')
  .addEdge('saveUserMessage', 'agentGenerate')
  .addEdge('agentGenerate', 'saveAgentAssistantMessage')
  .addEdge('saveAgentAssistantMessage', END)

export const agentChatGraph = graph.compile()
