import 'server-only'
import { resolveReviewRequest } from '../../db/queries/reviews'
import type { ReviewableChatState } from './reviewable'

const REJECTION_MESSAGE =
  'The response was reviewed and rejected. Please rephrase your question or try a different document.'

export async function applyReviewDecision(
  state: ReviewableChatState,
): Promise<Partial<ReviewableChatState>> {
  const { reviewId, reviewDecision } = state
  if (!reviewDecision || !reviewId) return {}

  resolveReviewRequest(reviewId, {
    status:
      reviewDecision.action === 'edit'
        ? 'edited'
        : reviewDecision.action === 'reject'
          ? 'rejected'
          : 'approved',
    humanFeedback: reviewDecision.feedback,
    editedOutput: reviewDecision.editedOutput,
  })

  if (reviewDecision.action === 'reject') return { assistantMessage: REJECTION_MESSAGE }
  if (reviewDecision.action === 'edit') {
    return { assistantMessage: reviewDecision.editedOutput ?? state.assistantMessage }
  }
  return {}
}
