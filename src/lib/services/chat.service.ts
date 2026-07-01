import 'server-only'
import { mainChatGraph } from '../graph/main.graph'
import { ragChatGraph } from '../graph/rag.graph'
import { selfRagChatGraph } from '../graph/selfRagChat.graph'
import { agentChatGraph } from '../graph/agentChat.graph'
import { getReviewRequestByGraphRunId } from '../db/queries/reviews'
import { startRun } from '../observability/run'
import type { ChatRequest, ChatResponse, RagChatRequest, Source } from '../../types/chat'

export async function sendMessage(req: ChatRequest): Promise<ChatResponse> {
  const result = await mainChatGraph.invoke({
    userMessage: req.message,
    conversationId: req.conversationId,
  })

  return {
    conversationId: result.conversationId as string,
    message: {
      role: 'assistant',
      content: result.assistantMessage as string,
    },
  }
}

export function streamMessage(req: ChatRequest): ReadableStream {
  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      const send = (obj: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))

      const { runId, finish, fail } = await startRun('main-chat', req.conversationId)

      try {
        const eventStream = mainChatGraph.streamEvents(
          { userMessage: req.message, conversationId: req.conversationId },
          { version: 'v2', configurable: { runId } },
        )

        let finalConversationId: string | undefined

        for await (const event of eventStream) {
          if (event.event === 'on_chat_model_stream') {
            const content = event.data?.chunk?.content
            if (typeof content === 'string' && content) {
              send({ type: 'token', content })
            }
          }

          if (event.event === 'on_chain_end') {
            const cid = event.data?.output?.conversationId
            if (typeof cid === 'string') finalConversationId = cid
          }
        }

        finish()
        send({ type: 'done', conversationId: finalConversationId })
      } catch (err) {
        fail(err)
        const message = err instanceof Error ? err.message : String(err)
        send({ type: 'error', message })
      } finally {
        controller.close()
      }
    },
  })
}

export function streamRagMessage(req: RagChatRequest): ReadableStream {
  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      const send = (obj: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))

      const { runId, finish, fail } = await startRun('rag-chat', req.conversationId)

      try {
        const eventStream = ragChatGraph.streamEvents(
          {
            userMessage: req.message,
            conversationId: req.conversationId,
            topK: req.topK ?? 5,
          },
          { version: 'v2', configurable: { runId } },
        )

        let finalConversationId: string | undefined
        let sourcesSent = false

        for await (const event of eventStream) {
          if (
            event.event === 'on_chain_end' &&
            event.name === 'retrieveChunksNode' &&
            !sourcesSent
          ) {
            const sources = event.data?.output?.sources as Source[] | undefined
            if (Array.isArray(sources)) {
              send({ type: 'sources', sources })
              sourcesSent = true
            }
          }

          if (event.event === 'on_chat_model_stream') {
            const content = event.data?.chunk?.content
            if (typeof content === 'string' && content) {
              send({ type: 'token', content })
            }
          }

          if (event.event === 'on_chain_end') {
            const cid = event.data?.output?.conversationId
            if (typeof cid === 'string') finalConversationId = cid
          }
        }

        finish()
        send({ type: 'done', conversationId: finalConversationId })
      } catch (err) {
        fail(err)
        const message = err instanceof Error ? err.message : String(err)
        send({ type: 'error', message })
      } finally {
        controller.close()
      }
    },
  })
}

export function streamAgentMessage(req: RagChatRequest): ReadableStream {
  const encoder = new TextEncoder()
  const graphRunId = crypto.randomUUID()

  return new ReadableStream({
    async start(controller) {
      const send = (obj: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))

      // Use graphRunId as both thread_id (HITL checkpoint key) and runId (trace key)
      const { finish, fail } = await startRun('agent-chat', req.conversationId, graphRunId)

      try {
        // Use invoke() instead of streamEvents() to avoid leaking intermediate
        // model outputs (gradeChunks JSON, verifyGrounding "supported", etc.)
        // as visible tokens in the UI.
        const result = await agentChatGraph.invoke(
          { userMessage: req.message, conversationId: req.conversationId },
          { configurable: { thread_id: graphRunId, runId: graphRunId } },
        )

        const assistantMessage = result.assistantMessage as string | undefined
        const sources = result.sources as Source[] | undefined
        const finalConversationId = result.conversationId as string | undefined

        // Detect graph interrupt (human review required)
        const graphState = await agentChatGraph.getState({
          configurable: { thread_id: graphRunId },
        })
        const interrupted = graphState.tasks.some(
          (t) => (t.interrupts ?? []).length > 0,
        )
        if (interrupted) {
          const review = getReviewRequestByGraphRunId(graphRunId)
          if (review) {
            // Run stays 'running' while awaiting human review — finish/fail happens on resume
            send({ type: 'review', reviewId: review.id, reason: review.reason })
            return
          }
        }

        if (Array.isArray(sources) && sources.length > 0) {
          send({ type: 'sources', sources })
        }

        if (assistantMessage) {
          send({ type: 'token', content: assistantMessage })
        }

        finish()
        send({ type: 'done', conversationId: finalConversationId })
      } catch (err) {
        fail(err)
        const message = err instanceof Error ? err.message : String(err)
        send({ type: 'error', message })
      } finally {
        controller.close()
      }
    },
  })
}

export function streamSelfRagMessage(req: RagChatRequest): ReadableStream {
  const encoder = new TextEncoder()
  const graphRunId = crypto.randomUUID()

  return new ReadableStream({
    async start(controller) {
      const send = (obj: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))

      // Use graphRunId as both thread_id (HITL checkpoint key) and runId (trace key)
      const { finish, fail } = await startRun('self-rag-chat', req.conversationId, graphRunId)

      try {
        const eventStream = selfRagChatGraph.streamEvents(
          {
            userMessage: req.message,
            conversationId: req.conversationId,
            topK: req.topK ?? 5,
          },
          { version: 'v2', configurable: { thread_id: graphRunId, runId: graphRunId } },
        )

        let finalConversationId: string | undefined
        let pendingSources: Source[] | undefined
        let sourcesSent = false
        let statusSent = false

        for await (const event of eventStream) {
          if (!statusSent && event.event === 'on_chain_start') {
            send({ type: 'status', stage: 'retrieving' })
            statusSent = true
          }

          if (event.event === 'on_chain_start' && event.name === 'rewriteRagQuery') {
            send({ type: 'status', stage: 'rewriting' })
          }

          if (event.event === 'on_chain_end') {
            const outputSources = event.data?.output?.sources as Source[] | undefined
            if (Array.isArray(outputSources) && outputSources.length > 0) {
              pendingSources = outputSources
            }
          }

          if (event.event === 'on_chat_model_stream') {
            const content = event.data?.chunk?.content
            if (typeof content === 'string' && content) {
              if (!sourcesSent && pendingSources) {
                send({ type: 'sources', sources: pendingSources })
                sourcesSent = true
              }
              send({ type: 'token', content })
            }
          }

          if (event.event === 'on_chain_end') {
            const cid = event.data?.output?.conversationId
            if (typeof cid === 'string') finalConversationId = cid
          }
        }

        if (!sourcesSent && pendingSources) {
          send({ type: 'sources', sources: pendingSources })
        }

        // Detect graph interrupt (human review required)
        try {
          const graphState = await selfRagChatGraph.getState({
            configurable: { thread_id: graphRunId },
          })
          const interrupted = graphState.tasks.some(
            (t) => (t.interrupts ?? []).length > 0,
          )
          if (interrupted) {
            const review = getReviewRequestByGraphRunId(graphRunId)
            if (review) {
              // Run stays 'running' while awaiting human review — finish/fail happens on resume
              send({ type: 'review', reviewId: review.id, reason: review.reason })
              return
            }
          }
        } catch {
          // graph completed normally; no interrupt
        }

        finish()
        send({ type: 'done', conversationId: finalConversationId })
      } catch (err) {
        fail(err)
        const message = err instanceof Error ? err.message : String(err)
        send({ type: 'error', message })
      } finally {
        controller.close()
      }
    },
  })
}
