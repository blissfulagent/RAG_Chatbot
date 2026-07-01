'use client'

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

interface GraphRun {
  id: string
  graphName: string
  status: string
  startedAt: number
  endedAt: number | null
}

interface Props {
  run: GraphRun
  events: TraceEvent[]
}

function JsonBlock({ value }: { value: string | null }) {
  if (!value) return <span className="text-zinc-400">—</span>
  try {
    const parsed = JSON.parse(value)
    return (
      <pre className="text-xs bg-zinc-50 rounded p-2 overflow-x-auto max-h-32 whitespace-pre-wrap break-all">
        {JSON.stringify(parsed, null, 2)}
      </pre>
    )
  } catch {
    return <span className="text-xs text-zinc-500">{value}</span>
  }
}

export function TraceDetail({ run, events }: Props) {
  const latency = run.endedAt ? run.endedAt - run.startedAt : null

  return (
    <div>
      <div className="mb-4 space-y-1 text-sm">
        <div><span className="text-zinc-500">Graph:</span> <span className="font-mono">{run.graphName}</span></div>
        <div><span className="text-zinc-500">Status:</span> <span className="font-medium">{run.status}</span></div>
        <div><span className="text-zinc-500">Started:</span> {new Date(run.startedAt).toLocaleString()}</div>
        {latency != null && (
          <div><span className="text-zinc-500">Total latency:</span> {latency}ms</div>
        )}
        <div><span className="text-zinc-500">Run ID:</span> <span className="font-mono text-xs">{run.id}</span></div>
      </div>

      <h3 className="font-semibold text-sm mb-2">Events ({events.length})</h3>

      {events.length === 0 ? (
        <p className="text-zinc-500 text-sm">No events recorded.</p>
      ) : (
        <div className="space-y-3">
          {events.map((ev) => (
            <div key={ev.id} className={`border rounded p-3 text-sm ${ev.error ? 'border-red-200 bg-red-50' : 'border-zinc-200'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono font-medium">{ev.nodeName}</span>
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  <span>{ev.eventType}</span>
                  {ev.latencyMs != null && <span>{ev.latencyMs}ms</span>}
                  <span>{new Date(ev.createdAt).toLocaleTimeString()}</span>
                </div>
              </div>
              {ev.error && (
                <div className="text-red-700 text-xs mb-2 font-medium">Error: {ev.error}</div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Input</div>
                  <JsonBlock value={ev.inputJson} />
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Output</div>
                  <JsonBlock value={ev.outputJson} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
