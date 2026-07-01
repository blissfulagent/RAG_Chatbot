'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ReviewRequest } from '@/types/chat'
import ReviewDecisionForm from './ReviewDecisionForm'

export default function ReviewQueue() {
  const [reviews, setReviews] = useState<ReviewRequest[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/review')
      if (res.ok) {
        const data = await res.json() as { reviews: ReviewRequest[] }
        setReviews(data.reviews)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchReviews() }, [fetchReviews])

  function handleDecision() {
    setSelected(null)
    fetchReviews()
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Loading...</p>
  }

  if (reviews.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No pending reviews.</p>
        <button
          onClick={fetchReviews}
          className="mt-4 text-sm text-blue-600 hover:underline"
        >
          Refresh
        </button>
      </div>
    )
  }

  const selectedReview = reviews.find((r) => r.id === selected) ?? null

  return (
    <div className="flex gap-6">
      <div className="w-72 shrink-0 space-y-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            {reviews.length} pending
          </span>
          <button onClick={fetchReviews} className="text-xs text-blue-600 hover:underline">
            Refresh
          </button>
        </div>
        {reviews.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelected(r.id)}
            className={`w-full text-left rounded-lg border p-3 transition-colors ${
              selected === r.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <p className="text-xs font-semibold text-amber-700 mb-1">{r.reason}</p>
            <p className="text-sm text-gray-600 line-clamp-2">{r.proposedOutput}</p>
            <p className="text-xs text-gray-400 mt-1">
              {new Date(r.createdAt).toLocaleString()}
            </p>
          </button>
        ))}
      </div>

      <div className="flex-1">
        {selectedReview ? (
          <ReviewDecisionForm review={selectedReview} onDecision={handleDecision} />
        ) : (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
            Select a review from the list
          </div>
        )}
      </div>
    </div>
  )
}
