import type { ReviewDecision } from '../../../types/chat'

export interface ReviewableChatState {
  conversationId?: string
  assistantMessage?: string
  groundingStatus?: 'supported' | 'unsupported' | 'unknown' | undefined
  reviewId?: string
  reviewDecision?: ReviewDecision
}
