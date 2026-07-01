import type { ReviewableChatState } from './reviewable'

export function decideHumanReview(state: ReviewableChatState): 'review' | 'no_review' {
  return state.groundingStatus === 'unsupported' ? 'review' : 'no_review'
}
