import { Annotation } from '@langchain/langgraph'

export interface BaseChatState {
  conversationId?: string
  userMessage: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  assistantMessage?: string
}

export const ChatGraphAnnotation = Annotation.Root({
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
})

export type ChatGraphState = typeof ChatGraphAnnotation.State
