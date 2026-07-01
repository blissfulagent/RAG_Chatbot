export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { listGraphRuns } from '../../../lib/db/queries/traces'

export function GET() {
  const runs = listGraphRuns()
  return NextResponse.json({ runs })
}
