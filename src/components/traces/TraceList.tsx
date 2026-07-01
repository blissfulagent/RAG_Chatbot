'use client'

interface GraphRun {
  id: string
  conversationId: string | null
  graphName: string
  status: string
  startedAt: number
  endedAt: number | null
}

interface Props {
  runs: GraphRun[]
  selectedId: string | null
  onSelect: (id: string) => void
}

const STATUS_COLORS: Record<string, string> = {
  success: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  running: 'bg-yellow-100 text-yellow-800',
}

export function TraceList({ runs, selectedId, onSelect }: Props) {
  if (runs.length === 0) {
    return <p className="text-zinc-500 text-sm">No runs yet. Send a chat message to see traces.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-zinc-200">
            <th className="text-left py-2 px-3 font-medium text-zinc-600">Status</th>
            <th className="text-left py-2 px-3 font-medium text-zinc-600">Graph</th>
            <th className="text-left py-2 px-3 font-medium text-zinc-600">Conversation</th>
            <th className="text-left py-2 px-3 font-medium text-zinc-600">Started</th>
            <th className="text-left py-2 px-3 font-medium text-zinc-600">Latency</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const latency = run.endedAt ? run.endedAt - run.startedAt : null
            const isSelected = run.id === selectedId
            return (
              <tr
                key={run.id}
                onClick={() => onSelect(run.id)}
                className={`border-b border-zinc-100 cursor-pointer hover:bg-zinc-50 ${isSelected ? 'bg-zinc-100' : ''}`}
              >
                <td className="py-2 px-3">
                  <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[run.status] ?? 'bg-zinc-100 text-zinc-700'}`}>
                    {run.status}
                  </span>
                </td>
                <td className="py-2 px-3 font-mono text-xs">{run.graphName}</td>
                <td className="py-2 px-3 font-mono text-xs text-zinc-500">
                  {run.conversationId ? run.conversationId.slice(0, 8) + '…' : '—'}
                </td>
                <td className="py-2 px-3 text-zinc-500">
                  {new Date(run.startedAt).toLocaleTimeString()}
                </td>
                <td className="py-2 px-3 text-zinc-500">
                  {latency != null ? `${latency}ms` : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
