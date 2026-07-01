import { NextResponse } from 'next/server';
import { dbHealthCheck } from '@/lib/db/queries/health';

export const runtime = 'nodejs';

export async function GET() {
  const result = dbHealthCheck();
  return NextResponse.json(result);
}
