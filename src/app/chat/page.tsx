'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ConversationSummary, Source } from '@/types/chat'
import ConversationSidebar from '@/components/chat/ConversationSidebar'
import ChatMessageList from '@/components/chat/ChatMessageList'
import ChatComposer from '@/components/chat/ChatComposer'
import SourcePanel from '@/components/chat/SourcePanel'

type Message = { role: 'user' | 'assistant'; content: string }

export default function ChatPage() {
  const router = useRouter()
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sources, setSources] = useState<Source[]>([])
  const [statusStage, setStatusStage] = useState<string | null>(null)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'embedding' | 'done' | 'error'>('idle')
  const [uploadError, setUploadError] = useState<string | null>(null)

  async function fetchConversations() {
    try {
      const res = await fetch('/api/conversations')
      if (res.ok) {
        const data = await res.json() as { conversations: ConversationSummary[] }
        setConversations(data.conversations)
      }
    } catch {
      // sidebar fetch failure is non-fatal
    }
  }

  useEffect(() => {
    fetchConversations()
  }, [])

  async function handleSelectConversation(id: string) {
    setSelectedConversationId(id)
    setError(null)
    setSources([])
    setStatusStage(null)
    try {
      const res = await fetch(`/api/conversations/${id}/messages`)
      if (res.ok) {
        const data = await res.json() as { messages: { role: 'user' | 'assistant'; content: string }[] }
        setMessages(data.messages)
      }
    } catch {
      setError('Failed to load messages')
    }
  }

  function handleNewChat() {
    setSelectedConversationId(undefined)
    setMessages([])
    setError(null)
    setSources([])
    setStatusStage(null)
  }

  async function handleUpload(file: File) {
    setUploadStatus('uploading')
    setUploadError(null)
    const form = new FormData()
    form.append('file', file)

    let documentId: string
    try {
      const res = await fetch('/api/documents', { method: 'POST', body: form })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setUploadError((data as { error?: string }).error ?? 'Upload failed')
        setUploadStatus('error')
        return
      }
      const data = await res.json() as { document: { id: string } }
      documentId = data.document.id
    } catch {
      setUploadError('Network error during upload')
      setUploadStatus('error')
      return
    }

    setUploadStatus('embedding')
    try {
      const res = await fetch(`/api/documents/${documentId}/embed`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setUploadError((data as { error?: string }).error ?? 'Embedding failed')
        setUploadStatus('error')
        return
      }
      setUploadStatus('done')
      router.refresh()
    } catch {
      setUploadError('Network error during embedding')
      setUploadStatus('error')
    }
  }

  async function handleSend(text: string) {
    setError(null)
    setSources([])
    setStatusStage(null)
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setLoading(true)

    const endpoint = '/api/chat/agent/stream'
    const body = { message: text, conversationId: selectedConversationId }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError((data as { error?: string }).error ?? 'Request failed')
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

      outer: while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data:')) continue
          let parsed: {
            type: string
            content?: string
            conversationId?: string
            message?: string
            sources?: Source[]
            stage?: string
            reviewId?: string
            reason?: string
          }
          try {
            parsed = JSON.parse(line.slice('data:'.length).trim())
          } catch {
            continue
          }

          if (parsed.type === 'status' && parsed.stage) {
            setStatusStage(parsed.stage)
          } else if (parsed.type === 'sources' && parsed.sources) {
            setSources(parsed.sources)
            setStatusStage(null)
          } else if (parsed.type === 'token' && parsed.content) {
            setStatusStage(null)
            setMessages((prev) => {
              const next = [...prev]
              next[next.length - 1] = {
                role: 'assistant',
                content: next[next.length - 1].content + parsed.content,
              }
              return next
            })
          } else if (parsed.type === 'done') {
            if (parsed.conversationId) {
              setSelectedConversationId(parsed.conversationId)
            }
            setStatusStage(null)
            await fetchConversations()
            break outer
          } else if (parsed.type === 'review') {
            setStatusStage('awaiting-review')
            setMessages((prev) => {
              const next = [...prev]
              next[next.length - 1] = {
                role: 'assistant',
                content: 'Waiting for human review...',
              }
              return next
            })
            setLoading(false)
            break outer
          } else if (parsed.type === 'error') {
            setError(parsed.message ?? 'Stream error')
            setMessages((prev) => prev.slice(0, -1))
            setStatusStage(null)
            break outer
          }
        }
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <ConversationSidebar
        conversations={conversations}
        selectedId={selectedConversationId}
        onSelect={handleSelectConversation}
        onNewChat={handleNewChat}
      />
      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="flex items-center justify-between px-6 py-3.5 bg-white border-b border-slate-200 shadow-sm">
          <h1 className="text-base font-semibold text-slate-900 tracking-tight">Modelchatter</h1>
          <span className="text-xs text-slate-400 font-medium">AI Assistant</span>
        </header>

        {statusStage && (
          <div className="flex items-center gap-2 px-6 py-2 bg-indigo-50 border-b border-indigo-100 text-xs text-indigo-600 font-medium">
            {statusStage === 'retrieving' && (
              <><span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />Searching documents…</>
            )}
            {statusStage === 'rewriting' && (
              <><span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />Refining query…</>
            )}
            {statusStage === 'awaiting-review' && (
              <span className="text-amber-600">
                Response flagged for human review.{' '}
                <a href="/review" className="underline font-semibold">Open queue →</a>
              </span>
            )}
          </div>
        )}

        {(uploadStatus === 'uploading' || uploadStatus === 'embedding' || uploadStatus === 'done' || uploadStatus === 'error') && (
          <div className={`px-6 py-2 text-xs font-medium border-b ${
            uploadStatus === 'done'
              ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
              : uploadStatus === 'error'
              ? 'bg-red-50 border-red-100 text-red-600'
              : 'bg-indigo-50 border-indigo-100 text-indigo-600'
          }`}>
            {uploadStatus === 'uploading' && '⬆ Uploading document…'}
            {uploadStatus === 'embedding' && '⚙ Processing and embedding document…'}
            {uploadStatus === 'done' && '✓ Document ready — you can now ask questions about it.'}
            {uploadStatus === 'error' && `✕ ${uploadError}`}
          </div>
        )}

        <ChatMessageList messages={messages} loading={loading} error={error} />
        {sources.length > 0 && <SourcePanel sources={sources} />}
        <ChatComposer onSend={handleSend} onUpload={handleUpload} loading={loading} />
      </div>
    </div>
  )
}
