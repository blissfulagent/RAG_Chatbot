import 'server-only'
import { desc, eq } from 'drizzle-orm'
import { db } from '../index'
import { graphRuns, traceEvents } from '../schema'

export function createGraphRun(data: {
  id: string
  graphName: string
  conversationId?: string
}): void {
  db.insert(graphRuns).values({
    id: data.id,
    graphName: data.graphName,
    conversationId: data.conversationId ?? null,
    status: 'running',
    startedAt: Date.now(),
    endedAt: null,
    metadataJson: null,
  }).run()
}

export function finishGraphRun(id: string): void {
  db.update(graphRuns)
    .set({ status: 'success', endedAt: Date.now() })
    .where(eq(graphRuns.id, id))
    .run()
}

export function failGraphRun(id: string, err?: unknown): void {
  const message = err instanceof Error ? err.message : err ? String(err) : undefined
  db.update(graphRuns)
    .set({
      status: 'failed',
      endedAt: Date.now(),
      metadataJson: message ? JSON.stringify({ error: message }) : null,
    })
    .where(eq(graphRuns.id, id))
    .run()
}

export function createTraceEvent(data: {
  runId: string
  nodeName: string
  eventType: string
  inputJson?: string | null
  outputJson?: string | null
  latencyMs?: number | null
  error?: string | null
}): void {
  db.insert(traceEvents).values({
    id: crypto.randomUUID(),
    runId: data.runId,
    nodeName: data.nodeName,
    eventType: data.eventType,
    inputJson: data.inputJson ?? null,
    outputJson: data.outputJson ?? null,
    latencyMs: data.latencyMs ?? null,
    error: data.error ?? null,
    createdAt: Date.now(),
  }).run()
}

export function getGraphRunById(id: string) {
  return db.select().from(graphRuns).where(eq(graphRuns.id, id)).get()
}

export function listGraphRuns(limit = 50) {
  return db.select().from(graphRuns).orderBy(desc(graphRuns.startedAt)).limit(limit).all()
}

export function getGraphRunWithEvents(id: string) {
  const run = db.select().from(graphRuns).where(eq(graphRuns.id, id)).get()
  if (!run) return null
  const events = db
    .select()
    .from(traceEvents)
    .where(eq(traceEvents.runId, id))
    .orderBy(traceEvents.createdAt)
    .all()
  return { run, events }
}
