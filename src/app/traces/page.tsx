'use client'

import { useEffect, useState } from 'react'
import { TraceList } from '../../components/traces/TraceList'
import { TraceDetail } from '../../components/traces/TraceDetail'

interface GraphRun {
  id: string
  conversationId: string | null
  graphName: string
  status: string
  startedAt: number
  endedAt: number | null
}

interface TraceEvent {
  id: string
  nodeName: string
  eventType: string
  inputJson: string | null
  outputJson: string | null
  latencyMs: number | null
  error: string | null
  createdAt: number
}

export default function TracesPage() {
  const [runs, setRuns] = useState<GraphRun[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<{ run: GraphRun; events: TraceEvent[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/traces')
      .then((r) => r.json())
      .then((data) => {
        setRuns(data.runs ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedId) { setDetail(null); return }
    fetch(`/api/traces/${selectedId}`)
      .then((r) => r.json())
      .then(setDetail)
      .catch(() => setDetail(null))
  }, [selectedId])

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Traces</h1>
        <p className="text-zinc-500 text-sm mt-1">Graph run history and node-level events</p>
      </div>

      <div className={`grid gap-6 ${detail ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Recent Runs</h2>
            <button
              onClick={() => {
                setLoading(true)
                fetch('/api/traces')
                  .then((r) => r.json())
                  .then((data) => { setRuns(data.runs ?? []); setLoading(false) })
                  .catch(() => setLoading(false))
              }}
              className="text-xs text-zinc-500 hover:text-zinc-800 underline"
            >
              Refresh
            </button>
          </div>
          {loading ? (
            <p className="text-zinc-500 text-sm">Loading…</p>
          ) : (
            <TraceList runs={runs} selectedId={selectedId} onSelect={setSelectedId} />
          )}
        </div>

        {detail && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Run Detail</h2>
              <button
                onClick={() => { setSelectedId(null); setDetail(null) }}
                className="text-xs text-zinc-500 hover:text-zinc-800 underline"
              >
                Close
              </button>
            </div>
            <TraceDetail run={detail.run} events={detail.events} />
          </div>
        )}
      </div>
    </main>
  )
}
