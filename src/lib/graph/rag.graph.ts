import { Annotation, END, START, StateGraph } from '@langchain/langgraph'
import type { RunnableConfig } from '@langchain/core/runnables'
import type { RetrievedChunk, Source } from '../../types/chat'
import { loadConversation } from './nodes/loadConversation'
import { saveUserMessage } from './nodes/saveUserMessage'
import { retrieveChunksNode } from './nodes/retrieveChunksNode'
import { generateRagAnswer } from './nodes/generateRagAnswer'
import { saveRagAssistantMessage } from './nodes/saveRagAssistantMessage'
import { withTrace } from '../observability/trace'

export const RagGraphAnnotation = Annotation.Root({
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
  topK: Annotation<number>({
    default: () => 5,
    reducer: (_, b) => b,
  }),
  retrievedChunks: Annotation<RetrievedChunk[]>({
    default: () => [],
    reducer: (_, b) => b,
  }),
  sources: Annotation<Source[]>({
    default: () => [],
    reducer: (_, b) => b,
  }),
})

export type RagGraphState = typeof RagGraphAnnotation.State

function runId(config?: RunnableConfig): string | undefined {
  return config?.configurable?.runId as string | undefined
}

const graph = new StateGraph(RagGraphAnnotation)
  .addNode('loadConversation', async (state: RagGraphState, config?: RunnableConfig) =>
    withTrace(runId(config), 'loadConversation', 'node',
      () => loadConversation(state),
      { conversationId: state.conversationId }),
  )
  .addNode('saveUserMessage', async (state: RagGraphState, config?: RunnableConfig) =>
    withTrace(runId(config), 'saveUserMessage', 'node',
      () => saveUserMessage(state),
      { conversationId: state.conversationId, role: 'user' }),
  )
  .addNode('retrieveChunksNode', async (state: RagGraphState, config?: RunnableConfig) =>
    withTrace(runId(config), 'retrieveChunks', 'node',
      () => retrieveChunksNode(state),
      { query: state.userMessage, topK: state.topK }),
  )
  .addNode('generateRagAnswer', async (state: RagGraphState, config?: RunnableConfig) =>
    withTrace(runId(config), 'generateRagAnswer', 'node',
      () => generateRagAnswer(state),
      { messageCount: state.history.length, chunkCount: state.retrievedChunks.length }),
  )
  .addNode('saveRagAssistantMessage', async (state: RagGraphState, config?: RunnableConfig) =>
    withTrace(runId(config), 'saveRagAssistantMessage', 'node',
      () => saveRagAssistantMessage(state),
      { conversationId: state.conversationId }),
  )
  .addEdge(START, 'loadConversation')
  .addEdge('loadConversation', 'saveUserMessage')
  .addEdge('saveUserMessage', 'retrieveChunksNode')
  .addEdge('retrieveChunksNode', 'generateRagAnswer')
  .addEdge('generateRagAnswer', 'saveRagAssistantMessage')
  .addEdge('saveRagAssistantMessage', END)

export const ragChatGraph = graph.compile()
