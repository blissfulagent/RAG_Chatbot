import 'server-only'
import { createTraceEvent } from '../db/queries/traces'

export async function withTrace<T>(
  runId: string | undefined,
  nodeName: string,
  eventType: string,
  fn: () => Promise<T>,
  compactInput?: unknown,
): Promise<T> {
  const start = Date.now()
  try {
    const result = await fn()
    if (runId) {
      createTraceEvent({
        runId,
        nodeName,
        eventType,
        inputJson: compactInput != null ? JSON.stringify(compactInput) : null,
        outputJson: result != null ? JSON.stringify(result) : null,
        latencyMs: Date.now() - start,
      })
    }
    return result
  } catch (err) {
    if (runId) {
      createTraceEvent({
        runId,
        nodeName,
        eventType,
        inputJson: compactInput != null ? JSON.stringify(compactInput) : null,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      })
    }
    throw err
  }
}
