import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getConversationById } from '@/lib/db/queries/conversations';
import { getMessagesByConversationId } from '@/lib/db/queries/messages';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const conversation = getConversationById(id);
  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  const rows = getMessagesByConversationId(id);
  const messages = rows.map((m) => ({
    id: m.id,
    role: m.role as 'user' | 'assistant',
    content: m.content,
    createdAt: m.createdAt,
  }));

  return NextResponse.json({ conversationId: id, messages });
}
