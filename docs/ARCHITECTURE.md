# Architecture

## Overview

Modelchatter is a single Next.js application. All frontend pages, backend API routes, database access, graph orchestration, RAG logic, and observability live in the same `app/` directory.

## Request Flow

```
Browser
    ↓ POST /api/chat/stream (SSE)
chat.service.ts          ← creates graph_runs row
    ↓
LangGraph compiled graph ← node wrappers write trace_events rows
    ↓ streamEvents() v2
SSE token stream         → client renders tokens
    ↓ (on complete)
chat.service.ts          ← marks graph_run success/failed
```

---

## LangGraph Graphs

### 1. mainChatGraph — Normal Chat

Linear, 4 nodes, no retrieval.

```
START → loadConversation → saveUserMessage → generateAnswer → saveAssistantMessage → END
```

Used by: `POST /api/chat/stream`

---

### 2. ragChatGraph — Basic RAG

Linear, 5 nodes. Retrieves top-K chunks before generating.

```
START → loadConversation → saveUserMessage → retrieveChunksNode → generateRagAnswer → saveRagAssistantMessage → END
```

`retrieveChunksNode` outputs `sources[]` which is sent to the client as a `{ type: 'sources' }` SSE event before tokens.

Used by: `POST /api/chat/rag/stream`

---

### 3. selfRagChatGraph — Self-RAG with HITL

Outer graph (6 nodes) wraps a compiled selfRagSubgraph. Uses `MemorySaver` checkpointer for HITL pause/resume.

```
START → loadConversation → saveUserMessage → selfRagSubgraph
    ↓ [decideHumanReview]
    ├─ no_review → saveRagAssistantMessage → END
    └─ review    → createReviewRequest (interrupt) → applyReviewDecision → saveRagAssistantMessage → END
```

**selfRagSubgraph** (6 nodes, retry loop):

```
START → selfRagRetrieve → gradeRetrievedChunks
    ↓ [decideContextQuality]
    ├─ generateGroundedAnswer → verifyGrounding
    │       ↓ [decideFinalAnswer]
    │       ├─ END (groundingStatus = supported)
    │       └─ honestFallback → END (groundingStatus = unsupported)
    └─ rewriteRagQuery → selfRagRetrieve  (retry, up to SELF_RAG_MAX_RETRIES)
```

HITL flow: when `groundingStatus = unsupported`, `decideHumanReview` routes to `createReviewRequest`, which calls LangGraph `interrupt()`. The graph checkpoints. Execution resumes when `/api/review/[id]/approve|reject|edit` is called.

Used by: `POST /api/chat/self-rag/stream` (not the default UI path — see `agentChatGraph` below, which is what `chat/page.tsx` actually calls).

---

### 4. agentChatGraph — Unified agent flow (default UI path)

Linear tool-routing graph (4 nodes) with a conditional HITL tail. This is the graph `chat/page.tsx` always calls via `POST /api/chat/agent/stream`.

```
START → loadConversation → saveUserMessage → agentGenerate
    ↓ [decideHumanReview]
    ├─ no_review → saveAgentAssistantMessage → END
    └─ review    → createReviewRequest (interrupt) → applyReviewDecision → saveAgentAssistantMessage → END
```

`agentGenerate` binds an `answer_from_documents` tool to the model. For document-shaped questions, the tool invokes `selfRagSubgraph` directly (grade → rewrite-if-weak → generate → verify grounding) and returns `{ answer, sources, groundingStatus }`; `agentGenerate` promotes `groundingStatus` into top-level `AgentChatState`. For general-knowledge questions, the model answers directly without calling the tool and `groundingStatus` stays `undefined`.

`decideHumanReview`, `createReviewRequest`, and `applyReviewDecision` are the *same* node implementations `selfRagChatGraph` uses (typed against a shared `ReviewableChatState` structural interface in `graph/nodes/reviewable.ts`) — when `groundingStatus === 'unsupported'`, this graph escalates to human review exactly like `selfRagChatGraph` does. Both graphs share one `SqliteSaver` checkpointer instance (`graph/checkpointer.ts`), keyed by `thread_id`, so pause/resume works the same way for either.

Because a review can now originate from either `agentChatGraph` or `selfRagChatGraph`, `review.service.ts#resumeGraph` looks up the originating graph via `graph_runs.graphName` (`'agent-chat'` vs `'self-rag-chat'`) and resumes the matching compiled graph.

Used by: `POST /api/chat/agent/stream`

---

## Document Pipeline

**SQLite** stores app persistence: `conversations`, `messages`, `documents`
(metadata/status only), `review_requests`, `graph_runs`, `trace_events`, and
LangGraph checkpoints.

**ChromaDB** is the active vector store: document chunk text, embeddings, and
retrieval metadata (`documentId`, `filename`, `chunkIndex`, `sourceType`,
`createdAt`) all live in Chroma, queried via similarity search instead of a
SQLite brute-force cosine scan. See `src/lib/vector/chroma.ts`.

The legacy `chunks` and `embeddings` SQLite tables/migrations still exist but
are unused by active code — left in place to avoid a destructive migration.

```
POST /api/documents          → upload file, create documents row (status: uploading)
    ↓ document.service.ts
    extractText()            → raw text (PDF via pdf-parse, txt direct), in-memory only
    chunk()                  → fixed-size chunks with overlap, in-memory only
    → documents.status = embedding
    embed()                  → Xenova all-MiniLM-L6-v2 (384-dim vectors), per chunk
    upsertChunks()            → ChromaDB: id, document text, embedding, metadata
    → documents.status = ready (or failed, with error message, on any step failure)

POST /api/documents/[id]/embed   → re-embed: re-extract + re-chunk from the stored
                                    file, delete old Chroma chunks for documentId,
                                    embed + upsert fresh ones
DELETE /api/documents/[id]       → delete Chroma chunks (documentId filter),
                                    delete the uploaded file, delete the documents row
```

Retrieval at query time:

```
retrieveChunks(query, topK)   [src/lib/rag/retrieve.ts]
    embed(query)              → query vector
    queryChunks(vector, topK) → ChromaDB collection.query() similarity search
    return top-K chunks       → same RetrievedChunk shape Self-RAG expects
```

---

## Observability

Every request through `chat.service.ts`:

```
startRun(graphName, conversationId)  → insert graph_runs row (status: running)
    ↓ graph executes
    each wrapped node calls withTrace(runId, nodeName, eventType, fn)
        → insert trace_events row (input, output, latencyMs, error)
finish() / fail()                    → update graph_runs (status: success/failed, endedAt)
```

`createReviewRequest` is the only unwrapped node — it calls `interrupt()` which would log as a false error.

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `conversations` | Chat sessions (id, title, timestamps) |
| `messages` | User + assistant messages (role, content, metadata) |
| `documents` | Uploaded files (filename, status, path) — chunk/vector data lives in ChromaDB, not here |
| `chunks` | *(unused — legacy)* Document chunks; superseded by ChromaDB |
| `embeddings` | *(unused — legacy)* Chunk vectors; superseded by ChromaDB |
| `graph_runs` | One row per graph execution (name, status, timing) |
| `trace_events` | Per-node events (input, output, latencyMs, error) |
| `review_requests` | HITL review items (reason, risk score, decision, feedback) |

Migrations live in `drizzle/`. Run `pnpm db:migrate` to apply.

---

## File Structure

```
app/
├── src/
│   ├── app/                    # Next.js pages + API routes
│   │   ├── api/chat/           # /stream, /rag/stream, /self-rag/stream
│   │   ├── api/conversations/
│   │   ├── api/documents/
│   │   ├── api/review/
│   │   ├── api/traces/
│   │   └── (pages)/            # chat, documents, review, traces
│   └── lib/
│       ├── ai/                 # model.ts, prompts.ts
│       ├── db/                 # schema, migrations, query files
│       ├── graph/
│       │   ├── nodes/          # individual node files, incl. shared reviewable.ts type
│       │   ├── subgraphs/      # selfRag.graph.ts
│       │   ├── checkpointer.ts # shared SqliteSaver, used by agentChat + selfRagChat graphs
│       │   ├── main.graph.ts
│       │   ├── rag.graph.ts
│       │   ├── agentChat.graph.ts
│       │   └── selfRagChat.graph.ts
│       ├── observability/      # run.ts, trace.ts
│       ├── rag/                # chunk, embed, extract, retrieve (queries ChromaDB)
│       ├── vector/             # chroma.ts — ChromaDB client wrapper (active vector store)
│       ├── guardrails/         # placeholder — dedicated guardrail subgraph planned, not yet implemented
│       └── services/           # chat.service.ts, document.service.ts, review.service.ts
└── drizzle/                    # migration SQL files
```

> Note: `src/lib/guardrails/` is an empty placeholder for a future dedicated
> GuardrailSubgraph. Shared TypeScript types currently live in `src/types/`,
> not `src/lib/`.
