import type { SelfRagChatState } from '../subgraphs/selfRag.graph'

export function decideHumanReview(state: SelfRagChatState): 'review' | 'no_review' {
  return state.groundingStatus === 'unsupported' ? 'review' : 'no_review'
}
