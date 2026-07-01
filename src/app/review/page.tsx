'use client'

import ReviewQueue from '@/components/review/ReviewQueue'

export default function ReviewPage() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Review Queue</h1>
        <p className="text-sm text-gray-500 mb-8">
          Approve, reject, or edit Self-RAG answers that could not be grounded in the uploaded documents.
        </p>
        <ReviewQueue />
      </div>
    </main>
  )
}
