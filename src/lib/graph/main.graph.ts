import { END, START, StateGraph } from '@langchain/langgraph'
import type { RunnableConfig } from '@langchain/core/runnables'
import { ChatGraphAnnotation } from './state'
import type { ChatGraphState } from './state'
import { generateAnswer } from './nodes/generateAnswer'
import { loadConversation } from './nodes/loadConversation'
import { saveAssistantMessage } from './nodes/saveAssistantMessage'
import { saveUserMessage } from './nodes/saveUserMessage'
import { withTrace } from '../observability/trace'

function runId(config?: RunnableConfig): string | undefined {
  return config?.configurable?.runId as string | undefined
}

const graph = new StateGraph(ChatGraphAnnotation)
  .addNode('loadConversation', async (state: ChatGraphState, config?: RunnableConfig) =>
    withTrace(runId(config), 'loadConversation', 'node',
      () => loadConversation(state),
      { conversationId: state.conversationId }),
  )
  .addNode('saveUserMessage', async (state: ChatGraphState, config?: RunnableConfig) =>
    withTrace(runId(config), 'saveUserMessage', 'node',
      () => saveUserMessage(state),
      { conversationId: state.conversationId, role: 'user' }),
  )
  .addNode('generateAnswer', async (state: ChatGraphState, config?: RunnableConfig) =>
    withTrace(runId(config), 'generateAnswer', 'node',
      () => generateAnswer(state),
      { messageCount: state.history.length }),
  )
  .addNode('saveAssistantMessage', async (state: ChatGraphState, config?: RunnableConfig) =>
    withTrace(runId(config), 'saveAssistantMessage', 'node',
      () => saveAssistantMessage(state),
      { conversationId: state.conversationId }),
  )
  .addEdge(START, 'loadConversation')
  .addEdge('loadConversation', 'saveUserMessage')
  .addEdge('saveUserMessage', 'generateAnswer')
  .addEdge('generateAnswer', 'saveAssistantMessage')
  .addEdge('saveAssistantMessage', END)

export const mainChatGraph = graph.compile()
