import 'server-only'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'

function requireEnv(name: string): string {
  const val = process.env[name]
  if (!val) throw new Error(`Missing required environment variable: ${name}`)
  return val
}

export function getChatModel() {
  return new ChatGoogleGenerativeAI({
    apiKey: requireEnv('GOOGLE_API_KEY'),
    model: process.env.GOOGLE_MODEL ?? 'gemini-2.5-flash',
  })
}
