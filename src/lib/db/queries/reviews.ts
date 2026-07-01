import 'server-only'
import { eq, desc } from 'drizzle-orm'
import { db } from '../index'
import { reviewRequests } from '../schema'
import type { ReviewRequest } from '../../../types/chat'

export function insertReviewRequest(data: {
  id: string
  conversationId: string
  graphRunId: string
  reason: string
  riskScore: number
  proposedOutput: string
}): void {
  db.insert(reviewRequests).values({
    ...data,
    messageId: null,
    status: 'pending',
    humanFeedback: null,
    editedOutput: null,
    createdAt: Date.now(),
    resolvedAt: null,
  }).run()
}

export function getReviewRequestById(id: string): ReviewRequest | undefined {
  return db.select().from(reviewRequests).where(eq(reviewRequests.id, id)).get() as ReviewRequest | undefined
}

export function getReviewRequestByGraphRunId(graphRunId: string): ReviewRequest | undefined {
  return db.select().from(reviewRequests).where(eq(reviewRequests.graphRunId, graphRunId)).get() as ReviewRequest | undefined
}

export function listPendingReviewRequests(): ReviewRequest[] {
  return db
    .select()
    .from(reviewRequests)
    .where(eq(reviewRequests.status, 'pending'))
    .orderBy(desc(reviewRequests.createdAt))
    .all() as ReviewRequest[]
}

export function resolveReviewRequest(
  id: string,
  update: {
    status: 'approved' | 'rejected' | 'edited'
    humanFeedback?: string
    editedOutput?: string
  },
): void {
  db.update(reviewRequests)
    .set({ ...update, resolvedAt: Date.now() })
    .where(eq(reviewRequests.id, id))
    .run()
}
