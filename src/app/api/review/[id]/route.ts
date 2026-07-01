export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getReviewRequestById } from '@/lib/db/queries/reviews'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const review = getReviewRequestById(id)
  if (!review) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ review })
}
