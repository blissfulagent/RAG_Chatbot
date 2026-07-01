# Demo Walkthrough

End-to-end tour of every implemented feature.

## Prerequisites

```bash
cd app
cp .env.example .env.local   # set GOOGLE_API_KEY
pnpm install
pnpm db:migrate
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 1. Normal Chat

Go to `/chat`. Select **Normal** mode. Type any message and press Enter.

- Tokens stream in real-time via SSE
- Conversation is persisted; refresh the page and history is restored
- Each request creates a `graph_runs` row and 4 `trace_events` rows

**What happens internally:**

```
POST /api/chat/stream { message }
→ mainChatGraph: loadConversation → saveUserMessage → generateAnswer → saveAssistantMessage
→ SSE: { type:'token', content } × N, then { type:'done', conversationId }
```

---

## 2. Document Ingestion

Go to `/documents`. Upload a PDF or text file.

1. Click **Upload** — `POST /api/documents` stores the file, creates a `documents` row with `status: pending`
2. Click **Embed** — `POST /api/documents/[id]/embed` runs the full pipeline:
   - Extracts text (pdf-parse for PDFs)
   - Splits into chunks (~500 tokens with overlap)
   - Embeds each chunk with `Xenova/all-MiniLM-L6-v2` (downloads ~80MB on first run)
   - Stores chunks + embeddings in SQLite
   - Updates `status: ready`

The embedding step can take 10–30 seconds on first run while the model downloads.

---

## 3. RAG Chat

Go to `/chat`. Select **RAG** mode. Ask something related to your uploaded document.

- Sources panel appears showing which chunks were retrieved
- Answer is grounded in retrieved context

**What happens internally:**

```
POST /api/chat/rag/stream { message, topK: 5 }
→ ragChatGraph: loadConversation → saveUserMessage → retrieveChunksNode
                                                         ↓ SSE: { type:'sources', sources }
→ generateRagAnswer → saveRagAssistantMessage
→ SSE: tokens, then done
```

---

## 4. Self-RAG Chat

Go to `/chat`. Select **Self-RAG** mode.

The pipeline does more work per message:

1. **Retrieve** — fetch top-K chunks for the query
2. **Grade** — Grok evaluates each chunk for relevance
3. If not enough relevant chunks: **rewrite query** and retrieve again (up to `SELF_RAG_MAX_RETRIES` times)
4. **Generate** — produce an answer from relevant chunks only
5. **Verify** — Grok checks whether the answer is supported by the context
6. If unsupported: **honest fallback** ("I don't have enough information...")
7. If unsupported after fallback: **human review** (see next section)

Status updates stream to the UI: `{ type:'status', stage:'retrieving' }`, `{ type:'status', stage:'rewriting' }`.

---

## 5. Human Review (HITL)

When Self-RAG produces an ungrounded answer with high risk, the graph pauses and creates a review request.

**To trigger manually:** Ask Self-RAG a question that has no matching document content — it will eventually route to human review.

1. The chat UI shows `{ type:'review', reviewId, reason }` — the user is told the response is under review
2. Go to `/review` — the pending request appears in the queue
3. Click **Approve**, **Reject**, or **Edit**:
   - **Approve** — original AI answer is sent to the user
   - **Reject** — a refusal message is returned
   - **Edit** — your edited text is returned
4. The graph resumes from the checkpoint (LangGraph `MemorySaver`), applies the decision, saves the final message

**API path for review actions:**
```
POST /api/review/[id]/approve
POST /api/review/[id]/reject  { feedback? }
POST /api/review/[id]/edit    { editedOutput }
```

---

## 6. Observability

Go to `/traces`.

- The list shows all graph runs with status (success/failed/running), graph name, conversation ID, and total latency
- Click any row to see the event timeline for that run
- Each event shows: node name, event type, latency, compact input/output JSON, and any error message

Traces are written by the `withTrace()` wrapper in every graph node registration. The `createReviewRequest` node is not traced (it calls LangGraph `interrupt()` which is control flow, not an error).

---

## API Quick Reference

| Endpoint | Method | Body | Purpose |
|----------|--------|------|---------|
| `/api/chat/stream` | POST | `{ message, conversationId? }` | Normal streaming chat |
| `/api/chat/rag/stream` | POST | `{ message, conversationId?, topK? }` | RAG streaming chat |
| `/api/chat/self-rag/stream` | POST | `{ message, conversationId?, topK? }` | Self-RAG streaming chat |
| `/api/documents` | POST | `multipart/form-data` | Upload document |
| `/api/documents/[id]/embed` | POST | — | Chunk + embed document |
| `/api/review` | GET | — | List pending review requests |
| `/api/review/[id]/approve` | POST | — | Approve response |
| `/api/review/[id]/reject` | POST | `{ feedback? }` | Reject response |
| `/api/review/[id]/edit` | POST | `{ editedOutput }` | Edit and approve response |
| `/api/traces` | GET | — | List recent graph runs |
| `/api/traces/[id]` | GET | — | Get run + trace events |
