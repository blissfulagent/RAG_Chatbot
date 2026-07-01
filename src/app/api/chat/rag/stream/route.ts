export const runtime = 'nodejs'

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { streamRagMessage } from '@/lib/services/chat.service'

const bodySchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1),
  topK: z.number().int().positive().optional(),
})

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 422 })
  }

  const stream = streamRagMessage(parsed.data)

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
