import { z } from 'zod'

export const ChatRequestSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'message cannot be empty')
    .max(8000, 'message too long'),
  conversationId: z.string().optional(),
})
