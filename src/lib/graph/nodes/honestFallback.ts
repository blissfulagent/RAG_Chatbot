import type { SelfRagChatState } from '../subgraphs/selfRag.graph'

// Does not overwrite assistantMessage: the ungrounded draft must survive intact
// so createReviewRequest can propose the real draft for human review, and
// applyReviewDecision can restore it on approval instead of a canned disclaimer.
export async function honestFallback(
  _state: SelfRagChatState,
): Promise<Partial<SelfRagChatState>> {
  return {
    sources: [],
    groundingStatus: 'unsupported',
  }
}
