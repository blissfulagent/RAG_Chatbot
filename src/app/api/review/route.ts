export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { listPendingReviewRequests } from '@/lib/db/queries/reviews'

export async function GET() {
  const reviews = listPendingReviewRequests()
  return NextResponse.json({ reviews })
}
