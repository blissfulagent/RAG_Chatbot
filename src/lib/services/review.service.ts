import 'server-only'
import { Command } from '@langchain/langgraph'
import { selfRagChatGraph } from '../graph/selfRagChat.graph'
import {
  getReviewRequestById,
  listPendingReviewRequests,
} from '../db/queries/reviews'
import type { ReviewDecision, ReviewRequest } from '../../types/chat'

export function getPendingReviews(): ReviewRequest[] {
  return listPendingReviewRequests()
}

export function getReview(id: string): ReviewRequest | undefined {
  return getReviewRequestById(id)
}

async function resumeGraph(id: string, decision: ReviewDecision): Promise<void> {
  const review = getReviewRequestById(id)
  if (!review) throw new Error(`Review ${id} not found`)
  if (review.status !== 'pending') throw new Error(`Review ${id} is not pending`)

  await selfRagChatGraph.invoke(new Command({ resume: decision }), {
    configurable: { thread_id: review.graphRunId },
  })
}

export async function approveReview(id: string, feedback?: string): Promise<void> {
  await resumeGraph(id, { action: 'approve', feedback })
}

export async function rejectReview(id: string, feedback?: string): Promise<void> {
  await resumeGraph(id, { action: 'reject', feedback })
}

export async function editReview(
  id: string,
  editedOutput: string,
  feedback?: string,
): Promise<void> {
  await resumeGraph(id, { action: 'edit', editedOutput, feedback })
}
