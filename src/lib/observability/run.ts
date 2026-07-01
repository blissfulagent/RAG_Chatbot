import 'server-only'
import { createGraphRun, failGraphRun, finishGraphRun } from '../db/queries/traces'

export async function startRun(graphName: string, conversationId?: string, existingId?: string) {
  const runId = existingId ?? crypto.randomUUID()
  createGraphRun({ id: runId, graphName, conversationId })
  return {
    runId,
    finish: () => finishGraphRun(runId),
    fail: (err?: unknown) => failGraphRun(runId, err),
  }
}
