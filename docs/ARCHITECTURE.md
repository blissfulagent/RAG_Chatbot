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

Used by: `POST /api/chat/self-rag/stream`

---

## Document Pipeline

```
POST /api/documents          → upload file, create documents row (status: pending)
POST /api/documents/[id]/embed
    ↓ document.service.ts
    extractText()            → raw text (PDF via pdf-parse, txt direct)
    chunk()                  → fixed-size chunks with overlap
    embed()                  → Xenova all-MiniLM-L6-v2 (384-dim vectors)
    → insert chunks rows
    → insert embeddings rows (vectorJson stored as JSON string)
    → update documents status: ready
```

Retrieval at query time:

```
retrieve(query, topK)
    embed(query)             → query vector
    load all embeddings      → O(n) scan
    cosineSimilarity()       → score each chunk
    return top-K chunks
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
| `documents` | Uploaded files (filename, status, path) |
| `chunks` | Document chunks (content, index, token count) |
| `embeddings` | Chunk vectors (model, dimensions, vectorJson) |
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
│       │   ├── nodes/          # 14 individual node files
│       │   ├── subgraphs/      # selfRag.graph.ts
│       │   ├── main.graph.ts
│       │   ├── rag.graph.ts
│       │   └── selfRagChat.graph.ts
│       ├── observability/      # run.ts, trace.ts
│       ├── rag/                # chunk, embed, extract, retrieve, similarity
│       ├── guardrails/         # placeholder — dedicated guardrail subgraph planned, not yet implemented
│       └── services/           # chat.service.ts, document.service.ts, review.service.ts
└── drizzle/                    # migration SQL files
```

> Note: `src/lib/guardrails/` is an empty placeholder for a future dedicated
> GuardrailSubgraph. Shared TypeScript types currently live in `src/types/`,
> not `src/lib/`.
