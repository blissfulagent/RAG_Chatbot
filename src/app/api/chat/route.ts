import { NextRequest, NextResponse } from 'next/server'
import { ChatRequestSchema } from '../../../lib/validation/chat'
import { sendMessage } from '../../../lib/services/chat.service'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = ChatRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  try {
    const result = await sendMessage(parsed.data)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.startsWith('CONVERSATION_NOT_FOUND:')) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }
    console.error('[POST /api/chat]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
