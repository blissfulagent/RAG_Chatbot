import type { Source } from '@/types/chat'

interface SourcePanelProps {
  sources: Source[]
}

export default function SourcePanel({ sources }: SourcePanelProps) {
  if (sources.length === 0) return null

  return (
    <div className="bg-white border-t border-slate-200 px-6 py-4">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
        Sources
      </p>
      <div className="flex flex-wrap gap-2">
        {sources.map((src, i) => (
          <div
            key={src.chunkId}
            className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs max-w-xs"
          >
            <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="font-medium text-slate-700 truncate">{src.filename}</p>
              <p className="text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">{src.contentPreview}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
