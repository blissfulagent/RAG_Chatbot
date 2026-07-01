'use client'

import type { ConversationSummary } from '@/types/chat'

interface ConversationSidebarProps {
  conversations: ConversationSummary[]
  selectedId: string | undefined
  onSelect: (id: string) => void
  onNewChat: () => void
}

export default function ConversationSidebar({
  conversations,
  selectedId,
  onSelect,
  onNewChat,
}: ConversationSidebarProps) {
  return (
    <aside className="w-64 flex-shrink-0 flex flex-col h-full bg-slate-900 text-slate-100">
      <div className="p-4 border-b border-slate-700/60">
        <button
          onClick={onNewChat}
          className="w-full px-3 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
        >
          + New Chat
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {conversations.length === 0 && (
          <p className="text-slate-500 text-xs px-4 py-3">No conversations yet.</p>
        )}
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            title={c.title}
            className={`w-full text-left px-4 py-2.5 text-sm truncate transition-colors rounded-lg mx-1 my-0.5 ${
              c.id === selectedId
                ? 'bg-slate-700 text-white font-medium'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
            style={{ width: 'calc(100% - 8px)' }}
          >
            {c.title}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-700/60">
        <p className="text-xs text-slate-500 font-medium tracking-wide">Modelchatter</p>
      </div>
    </aside>
  )
}
