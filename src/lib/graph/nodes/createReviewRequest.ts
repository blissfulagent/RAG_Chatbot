import 'server-only'
import { interrupt } from '@langchain/langgraph'
import type { LangGraphRunnableConfig } from '@langchain/langgraph'
import { insertReviewRequest } from '../../db/queries/reviews'
import type { ReviewableChatState } from './reviewable'
import type { ReviewDecision } from '../../../types/chat'

export async function createReviewRequest(
  state: ReviewableChatState,
  config: LangGraphRunnableConfig,
): Promise<Partial<ReviewableChatState>> {
  const reviewId = crypto.randomUUID()
  const graphRunId = config.configurable?.thread_id as string

  insertReviewRequest({
    id: reviewId,
    conversationId: state.conversationId!,
    graphRunId,
    reason: 'grounding_unsupported',
    riskScore: 80,
    proposedOutput: state.assistantMessage ?? '',
  })

  const reviewDecision = interrupt({ reviewId, reason: 'grounding_unsupported' }) as ReviewDecision

  return { reviewId, reviewDecision }
}
