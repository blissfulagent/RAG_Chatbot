import { Annotation, END, START, StateGraph } from '@langchain/langgraph'
import type { RunnableConfig } from '@langchain/core/runnables'
import type { Source, ReviewDecision } from '../../types/chat'
import { checkpointer } from './checkpointer'
import { loadConversation } from './nodes/loadConversation'
import { saveUserMessage } from './nodes/saveUserMessage'
import { agentGenerate } from './nodes/agentGenerate'
import { saveAgentAssistantMessage } from './nodes/saveAgentAssistantMessage'
import { decideHumanReview } from './nodes/decideHumanReview'
import { createReviewRequest } from './nodes/createReviewRequest'
import { applyReviewDecision } from './nodes/applyReviewDecision'
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
  reviewId: Annotation<string | undefined>({
    default: () => undefined,
    reducer: (_, b) => b,
  }),
  reviewDecision: Annotation<ReviewDecision | undefined>({
    default: () => undefined,
    reducer: (_, b) => b,
  }),
})

export type AgentChatState = typeof AgentChatAnnotation.State

function runId(config?: RunnableConfig): string | undefined {
  return config?.configurable?.runId as string | undefined
}

type AnyNode =
  | ((state: AgentChatState) => Promise<Partial<AgentChatState>>)
  | ((state: AgentChatState, config: unknown) => Promise<Partial<AgentChatState>>)

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
  // createReviewRequest calls interrupt() — leave unwrapped to avoid false error traces
  .addNode('createReviewRequest', createReviewRequest as unknown as AnyNode)
  .addNode('applyReviewDecision', async (state: AgentChatState, config?: RunnableConfig) =>
    withTrace(runId(config), 'applyReviewDecision', 'node',
      () => applyReviewDecision(state),
      { reviewId: state.reviewId }),
  )
  .addEdge(START, 'loadConversation')
  .addEdge('loadConversation', 'saveUserMessage')
  .addEdge('saveUserMessage', 'agentGenerate')
  .addConditionalEdges('agentGenerate', decideHumanReview, {
    no_review: 'saveAgentAssistantMessage',
    review: 'createReviewRequest',
  })
  .addEdge('createReviewRequest', 'applyReviewDecision')
  .addEdge('applyReviewDecision', 'saveAgentAssistantMessage')
  .addEdge('saveAgentAssistantMessage', END)

export const agentChatGraph = graph.compile({ checkpointer })
