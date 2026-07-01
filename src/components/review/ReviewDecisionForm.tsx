'use client'

import { useState } from 'react'
import type { ReviewRequest } from '@/types/chat'

interface Props {
  review: ReviewRequest
  onDecision: () => void
}

export default function ReviewDecisionForm({ review, onDecision }: Props) {
  const [feedback, setFeedback] = useState('')
  const [editedOutput, setEditedOutput] = useState(review.proposedOutput)
  const [mode, setMode] = useState<'idle' | 'edit'>('idle')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(action: 'approve' | 'reject' | 'edit') {
    setSubmitting(true)
    setError(null)
    try {
      const body =
        action === 'edit'
          ? { editedOutput, feedback: feedback || undefined }
          : { feedback: feedback || undefined }

      const res = await fetch(`/api/review/${review.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Request failed')
      }

      onDecision()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-4">
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Reason</p>
        <p className="text-sm text-amber-700 bg-amber-50 rounded px-2 py-1">{review.reason}</p>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Proposed output</p>
        {mode === 'edit' ? (
          <textarea
            className="w-full border border-gray-300 rounded p-2 text-sm font-mono min-h-[100px]"
            value={editedOutput}
            onChange={(e) => setEditedOutput(e.target.value)}
          />
        ) : (
          <p className="text-sm text-gray-700 bg-gray-50 rounded px-2 py-2 whitespace-pre-wrap">
            {review.proposedOutput}
          </p>
        )}
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
          Feedback (optional)
        </label>
        <textarea
          className="w-full border border-gray-300 rounded p-2 text-sm min-h-[60px]"
          placeholder="Add notes for the reviewer log..."
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          disabled={submitting}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => submit('approve')}
          disabled={submitting}
          className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          onClick={() => submit('reject')}
          disabled={submitting}
          className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
        >
          Reject
        </button>
        {mode === 'idle' ? (
          <button
            onClick={() => setMode('edit')}
            disabled={submitting}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Edit
          </button>
        ) : (
          <>
            <button
              onClick={() => submit('edit')}
              disabled={submitting || !editedOutput.trim()}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Submit edit
            </button>
            <button
              onClick={() => { setMode('idle'); setEditedOutput(review.proposedOutput) }}
              disabled={submitting}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  )
}
