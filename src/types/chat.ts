export type ChatRequest = { conversationId?: string; message: string }

export type RetrievedChunk = {
  chunkId: string
  documentId: string
  content: string
  score: number
}

export type Source = {
  chunkId: string
  documentId: string
  filename: string
  score: number
  contentPreview: string
}

export type RagChatRequest = {
  conversationId?: string
  message: string
  topK?: number
}

export type ChatResponse = {
  conversationId: string
  message: { role: 'assistant'; content: string }
}

export type ConversationSummary = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
}

export type MessageRecord = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
}

export type ReviewDecision = {
  action: 'approve' | 'reject' | 'edit'
  editedOutput?: string
  feedback?: string
}

export type ReviewRequest = {
  id: string
  conversationId: string
  messageId: string | null
  graphRunId: string
  reason: string
  riskScore: number
  proposedOutput: string
  status: 'pending' | 'approved' | 'rejected' | 'edited'
  humanFeedback: string | null
  editedOutput: string | null
  createdAt: number
  resolvedAt: number | null
}
