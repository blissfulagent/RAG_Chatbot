import 'server-only'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { selfRagSubgraph } from '../graph/subgraphs/selfRag.graph'
import type { Source } from '../../types/chat'

export const answerFromDocumentsTool = new DynamicStructuredTool({
  name: 'answer_from_documents',
  description:
    'Search ingested documents and return a grounded answer with source citations. ' +
    'Use this when the user asks about content that may be in uploaded documents.',
  schema: z.object({
    question: z.string().describe('The question to answer from documents'),
    topK: z.number().optional().describe('Number of chunks to retrieve. Defaults to 5.'),
  }),
  func: async ({ question, topK }) => {
    const clampedTopK = Math.min(10, Math.max(1, Math.round(topK ?? 5)))
    const result = await selfRagSubgraph.invoke({
      userMessage: question,
      topK: clampedTopK,
      history: [],
      activeQuery: question,
    })
    const toolResult: {
      answer: string
      sources: Source[]
      groundingStatus: 'supported' | 'unsupported' | 'unknown'
    } = {
      answer: result.assistantMessage ?? 'No answer found in documents.',
      sources: result.sources ?? [],
      groundingStatus: result.groundingStatus ?? 'unknown',
    }
    return JSON.stringify(toolResult)
  },
})
