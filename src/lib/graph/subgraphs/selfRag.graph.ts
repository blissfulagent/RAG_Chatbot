import 'server-only'
import { Annotation, END, START, StateGraph } from '@langchain/langgraph'
import type { RunnableConfig } from '@langchain/core/runnables'
import type { RetrievedChunk, ReviewDecision, Source } from '../../../types/chat'
import { selfRagRetrieve } from '../nodes/selfRagRetrieve'
import { gradeRetrievedChunks } from '../nodes/gradeRetrievedChunks'
import { rewriteRagQuery } from '../nodes/rewriteRagQuery'
import { generateGroundedAnswer } from '../nodes/generateGroundedAnswer'
import { verifyGrounding } from '../nodes/verifyGrounding'
import { honestFallback } from '../nodes/honestFallback'
import { withTrace } from '../../observability/trace'
import { createTraceEvent } from '../../db/queries/traces'

export const SelfRagChatAnnotation = Annotation.Root({
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
    default: () => Number(process.env.SELF_RAG_TOP_K ?? '5'),
    reducer: (_, b) => b,
  }),
  activeQuery: Annotation<string>({
    default: () => '',
    reducer: (_, b) => b,
  }),
  retrievedChunks: Annotation<RetrievedChunk[]>({
    default: () => [],
    reducer: (_, b) => b,
  }),
  relevantChunks: Annotation<RetrievedChunk[]>({
    default: () => [],
    reducer: (_, b) => b,
  }),
  sources: Annotation<Source[]>({
    default: () => [],
    reducer: (_, b) => b,
  }),
  retryCount: Annotation<number>({
    default: () => 0,
    reducer: (_, b) => b,
  }),
  maxRetries: Annotation<number>({
    default: () => Number(process.env.SELF_RAG_MAX_RETRIES ?? '1'),
    reducer: (_, b) => b,
  }),
  groundingStatus: Annotation<'supported' | 'unsupported' | 'unknown'>({
    default: () => 'unknown',
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

export type SelfRagChatState = typeof SelfRagChatAnnotation.State

const MIN_RELEVANT_CHUNKS = Number(process.env.SELF_RAG_MIN_RELEVANT_CHUNKS ?? '1')

function decideContextQuality(state: SelfRagChatState, config?: RunnableConfig): string {
  const hasEnough = state.relevantChunks.length >= MIN_RELEVANT_CHUNKS
  const canRetry = state.retryCount < state.maxRetries
  const route = !hasEnough && canRetry ? 'rewriteRagQuery' : 'generateGroundedAnswer'

  const decisionLog = {
    query: state.activeQuery || state.userMessage,
    retryCount: state.retryCount,
    relevantChunkCount: state.relevantChunks.length,
    route,
  }
  console.log('[selfRag] decideContextQuality', decisionLog)

  const id = runId(config)
  if (id) {
    createTraceEvent({
      runId: id,
      nodeName: 'decideContextQuality',
      eventType: 'decision',
      outputJson: JSON.stringify(decisionLog),
    })
  }

  return route
}

function decideFinalAnswer(state: SelfRagChatState): string {
  if (state.groundingStatus === 'unsupported') return 'honestFallback'
  return '__end__'
}

function runId(config?: RunnableConfig): string | undefined {
  return config?.configurable?.runId as string | undefined
}

const subgraph = new StateGraph(SelfRagChatAnnotation)
  .addNode('selfRagRetrieve', async (state: SelfRagChatState, config?: RunnableConfig) =>
    withTrace(runId(config), 'selfRagRetrieve', 'node',
      () => selfRagRetrieve(state),
      { query: state.activeQuery || state.userMessage, topK: state.topK }),
  )
  .addNode('gradeRetrievedChunks', async (state: SelfRagChatState, config?: RunnableConfig) =>
    withTrace(runId(config), 'gradeRetrievedChunks', 'node',
      () => gradeRetrievedChunks(state),
      { chunkCount: state.retrievedChunks.length }),
  )
  .addNode('rewriteRagQuery', async (state: SelfRagChatState, config?: RunnableConfig) =>
    withTrace(runId(config), 'rewriteRagQuery', 'node',
      () => rewriteRagQuery(state),
      { previousQuery: state.activeQuery, retryCount: state.retryCount }),
  )
  .addNode('generateGroundedAnswer', async (state: SelfRagChatState, config?: RunnableConfig) =>
    withTrace(runId(config), 'generateGroundedAnswer', 'node',
      () => generateGroundedAnswer(state),
      { messageCount: state.history.length, relevantChunkCount: state.relevantChunks.length }),
  )
  .addNode('verifyGrounding', async (state: SelfRagChatState, config?: RunnableConfig) =>
    withTrace(runId(config), 'verifyGrounding', 'node',
      () => verifyGrounding(state),
      { answerLength: state.assistantMessage?.length }),
  )
  .addNode('honestFallback', async (state: SelfRagChatState, config?: RunnableConfig) =>
    withTrace(runId(config), 'honestFallback', 'node',
      () => honestFallback(state),
      { groundingStatus: state.groundingStatus }),
  )
  .addEdge(START, 'selfRagRetrieve')
  .addEdge('selfRagRetrieve', 'gradeRetrievedChunks')
  .addConditionalEdges('gradeRetrievedChunks', decideContextQuality, {
    rewriteRagQuery: 'rewriteRagQuery',
    generateGroundedAnswer: 'generateGroundedAnswer',
  })
  .addEdge('rewriteRagQuery', 'selfRagRetrieve')
  .addEdge('generateGroundedAnswer', 'verifyGrounding')
  .addConditionalEdges('verifyGrounding', decideFinalAnswer, {
    honestFallback: 'honestFallback',
    __end__: END,
  })
  .addEdge('honestFallback', END)

export const selfRagSubgraph = subgraph.compile()
