export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getGraphRunWithEvents } from '../../../../lib/db/queries/traces'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = getGraphRunWithEvents(id)
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(data)
}
