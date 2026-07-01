import { END, START, StateGraph } from '@langchain/langgraph'
import type { RunnableConfig } from '@langchain/core/runnables'
import { checkpointer } from './checkpointer'
import { SelfRagChatAnnotation, selfRagSubgraph } from './subgraphs/selfRag.graph'
import type { SelfRagChatState } from './subgraphs/selfRag.graph'
import { loadConversation } from './nodes/loadConversation'
import { saveUserMessage } from './nodes/saveUserMessage'
import { saveRagAssistantMessage } from './nodes/saveRagAssistantMessage'
import { decideHumanReview } from './nodes/decideHumanReview'
import { createReviewRequest } from './nodes/createReviewRequest'
import { applyReviewDecision } from './nodes/applyReviewDecision'
import { withTrace } from '../observability/trace'

function runId(config?: RunnableConfig): string | undefined {
  return config?.configurable?.runId as string | undefined
}

type AnyNode =
  | ((state: SelfRagChatState) => Promise<Partial<SelfRagChatState>>)
  | ((state: SelfRagChatState, config: unknown) => Promise<Partial<SelfRagChatState>>)

const graph = new StateGraph(SelfRagChatAnnotation)
  .addNode('loadConversation', async (state: SelfRagChatState, config?: RunnableConfig) =>
    withTrace(runId(config), 'loadConversation', 'node',
      () => loadConversation(state),
      { conversationId: state.conversationId }),
  )
  .addNode('saveUserMessage', async (state: SelfRagChatState, config?: RunnableConfig) =>
    withTrace(runId(config), 'saveUserMessage', 'node',
      () => saveUserMessage(state),
      { conversationId: state.conversationId, role: 'user' }),
  )
  .addNode('selfRag', selfRagSubgraph)
  // createReviewRequest calls interrupt() — leave unwrapped to avoid false error traces
  .addNode('createReviewRequest', createReviewRequest as unknown as AnyNode)
  .addNode('applyReviewDecision', async (state: SelfRagChatState, config?: RunnableConfig) =>
    withTrace(runId(config), 'applyReviewDecision', 'node',
      () => applyReviewDecision(state),
      { reviewId: state.reviewId }),
  )
  .addNode('saveRagAssistantMessage', async (state: SelfRagChatState, config?: RunnableConfig) =>
    withTrace(runId(config), 'saveRagAssistantMessage', 'node',
      () => saveRagAssistantMessage(state),
      { conversationId: state.conversationId }),
  )
  .addEdge(START, 'loadConversation')
  .addEdge('loadConversation', 'saveUserMessage')
  .addEdge('saveUserMessage', 'selfRag')
  .addConditionalEdges('selfRag', decideHumanReview, {
    no_review: 'saveRagAssistantMessage',
    review: 'createReviewRequest',
  })
  .addEdge('createReviewRequest', 'applyReviewDecision')
  .addEdge('applyReviewDecision', 'saveRagAssistantMessage')
  .addEdge('saveRagAssistantMessage', END)

export const selfRagChatGraph = graph.compile({ checkpointer })
