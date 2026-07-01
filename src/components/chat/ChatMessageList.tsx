'use client'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ChatMessageListProps {
  messages: Message[]
  loading: boolean
  error: string | null
}

function AssistantBubble({ content }: { content: string }) {
  return (
    <div className="max-w-2xl rounded-2xl rounded-tl-sm bg-white border border-slate-200 shadow-sm px-5 py-3.5 text-sm text-slate-800 leading-relaxed">
      {content.split('\n').map((line, i, arr) => (
        <span key={i}>
          {line}
          {i < arr.length - 1 && <br />}
        </span>
      ))}
    </div>
  )
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="max-w-xl rounded-2xl rounded-tr-sm bg-indigo-600 px-5 py-3 text-sm text-white leading-relaxed shadow-sm">
      {content}
    </div>
  )
}

function ThinkingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="max-w-2xl rounded-2xl rounded-tl-sm bg-white border border-slate-200 shadow-sm px-5 py-3.5">
        <span className="flex gap-1 items-center">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
        </span>
      </div>
    </div>
  )
}

export default function ChatMessageList({ messages, loading, error }: ChatMessageListProps) {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5 bg-slate-50">
      {messages.map((msg, i) => (
        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          {msg.role === 'assistant' ? (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider ml-1">
                Assistant
              </span>
              <AssistantBubble content={msg.content} />
            </div>
          ) : (
            <UserBubble content={msg.content} />
          )}
        </div>
      ))}
      {loading && <ThinkingIndicator />}
      {error && (
        <div className="flex justify-center">
          <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {error}
          </p>
        </div>
      )}
    </div>
  )
}
