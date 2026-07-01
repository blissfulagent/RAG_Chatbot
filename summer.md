# Modelchatter — Architecture & Audit Report

> Generated: 2026-06-30

---

## 1. Top-Level Directory Structure

| Path | Role |
|---|---|
| `src/app/` | Next.js App Router pages (`/chat`, `/documents`, `/review`, `/traces`) and all API routes |
| `src/app/api/` | REST + SSE API: chat (4 modes), conversations, documents, retrieval test, review HITL, traces, DB health |
| `src/components/chat/` | Client chat UI (composer, message list, sidebar, source panel) |
| `src/components/documents/` | Document upload, list, retrieval tester |
| `src/components/review/` | Review queue and decision form |
| `src/components/traces/` | Run list and per-run event detail |
| `src/lib/ai/` | LLM provider wrapper (`model.ts`) and prompt constants (`prompts.ts`) |
| `src/lib/db/` | Drizzle schema, db connection, per-table query modules |
| `src/lib/graph/` | Four LangGraph compiled graphs (`main`, `rag`, `agentChat`, `selfRagChat`) |
| `src/lib/graph/nodes/` | 18 individual node functions |
| `src/lib/graph/subgraphs/` | `selfRag.graph.ts` — the inner self-RAG retry subgraph |
| `src/lib/observability/` | `run.ts` (graph run lifecycle) and `trace.ts` (per-node `withTrace` wrapper) |
| `src/lib/rag/` | Text extraction, chunking, local embedding model, cosine similarity, retrieval |
| `src/lib/services/` | `chat.service.ts` (all four streaming modes), `document.service.ts` (ingest pipeline), `review.service.ts` (HITL resume) |
| `src/lib/tools/` | `answerFromDocuments` DynamicStructuredTool (wraps `selfRagSubgraph`) |
| `src/lib/validation/` | Zod schema for base chat request |
| `src/lib/guardrails/` | Empty directory (placeholder — feature not implemented) |
| `src/lib/types/` | Empty directory (actual types live in `src/types/`) |
| `src/types/` | Shared TS types: `ChatRequest`, `RagChatRequest`, `RetrievedChunk`, `Source`, `ReviewRequest`, etc. |
| `drizzle/` | 4 SQL migration files + Drizzle journal/snapshot metadata |
| `data/` | SQLite database file |
| `uploads/` | Uploaded document files (UUID-prefixed) |
| `docs/` | `ARCHITECTURE.md`, `DEMO.md`, `LIMITATIONS.md` |

---

## 2. Data Flow (Main Request Path)

```
User message
  └─> /api/chat/agent/stream (hardcoded in UI)
        └─> chat.service.ts → streamAgentMessage()
              └─> agentChatGraph.invoke()
                    ├─> loadConversation     (load/create DB row, populate history)
                    ├─> agentGenerate        (tool-calling loop → answerFromDocuments tool)
                    │     └─> selfRagSubgraph (inner: retrieve → grade → maybe rewrite → generate → verify)
                    ├─> saveAgentAssistantMessage  (persist to DB)
                    └─> SSE token stream → client
```

For self-RAG with HITL (`/api/chat/self-rag/stream`):

```
selfRagChatGraph (outer, with MemorySaver checkpointer)
  ├─> loadConversation
  ├─> selfRagSubgraph (inner compiled graph, no checkpointer)
  │     ├─> selfRagRetrieve
  │     ├─> gradeRetrievedChunks
  │     ├─> [decideContextQuality] ──── weak context ──> rewriteRagQuery ─> loop
  │     │                           └── good context ──> generateGroundedAnswer
  │     ├─> verifyGrounding
  │     ├─> [decideNextStep] ──── unsupported ──> honestFallback
  │     │                     └── supported   ──> END
  │     └─> END
  ├─> [decideHumanReview] ──── groundingStatus=unsupported ──> createReviewRequest ──> interrupt()
  │                        └── otherwise ──────────────────> saveRagAssistantMessage
  └─> [after human approval] applyReviewDecision → saveRagAssistantMessage
```

---

## 3. Per-File Summary

### Config & Root

**`package.json`**
Dependencies: `@huggingface/transformers` (local embeddings), `@langchain/google-genai`, `@langchain/langgraph`, `better-sqlite3`, `drizzle-orm`, `pdf-parse@^2.4.5`, `zod`, `next@16.2.9`, `react@19`. Dev: `drizzle-kit`, `tailwindcss@^4`, `tsx`.

**`next.config.ts`**
Sets `serverExternalPackages: ['pdf-parse', 'pdfjs-dist']`. Note: `pdfjs-dist` is not a listed dependency.

**`tsconfig.json`**
Strict TypeScript, `bundler` module resolution, `@/*` path alias → `./src/*`.

**`drizzle.config.ts`**
SQLite dialect; DB URL from `DATABASE_URL` env var, fallback to `file:./data/modelchatter.sqlite`.

**`pnpm-workspace.yaml`**
Configures `allowBuilds` for native modules (`better-sqlite3`, `onnxruntime-node`, etc.).

**`.env.example`**
Documents environment variables. **Contains wrong variable names** — see Bug 1.

---

### Database (`src/lib/db/`)

**`schema.ts`**
Defines 8 SQLite tables. All timestamps as Unix ms integers.
- `conversations`: id, title, createdAt, updatedAt
- `messages`: id, conversationId (FK), role, content, metadataJson, createdAt
- `graphRuns`: id, conversationId (FK optional), graphName, status, startedAt, endedAt, metadataJson
- `traceEvents`: id, runId (FK optional), nodeName, eventType, inputJson, outputJson, latencyMs, error, createdAt
- `documents`: id, filename (UUID-prefixed), originalName, mimeType, filePath, status, error, createdAt, updatedAt
- `chunks`: id, documentId (FK), chunkIndex, content, tokenCount, metadataJson, createdAt
- `embeddings`: id, chunkId (FK), model, dimensions, vectorJson, createdAt; unique index on `(chunkId, model)`
- `reviewRequests`: id, conversationId (FK), messageId (nullable), graphRunId, reason, riskScore, proposedOutput, status, humanFeedback, editedOutput, createdAt, resolvedAt

**`index.ts`**
Creates `better-sqlite3` connection; ensures `data/` directory exists; exports `db` singleton.

**`queries/conversations.ts`**
Exports: `createConversation`, `getConversationById`, `listConversations`. All synchronous.

**`queries/messages.ts`**
Exports: `insertMessage`, `getMessagesByConversationId`. Synchronous.

**`queries/documents.ts`**
Exports: `insertDocument`, `updateDocumentStatus`, `insertChunks`, `listDocuments`, `getDocumentById`, `getChunksByDocumentId`, `countChunksByDocumentId`. All async.

**`queries/embeddings.ts`**
Exports: `insertEmbedding` (with `onConflictDoNothing`), `getEmbeddedChunkIds`, `getAllEmbeddingsWithChunks`. All async.

**`queries/traces.ts`**
Exports: `createGraphRun`, `finishGraphRun`, `failGraphRun`, `createTraceEvent`, `listGraphRuns`, `getGraphRunWithEvents`. Synchronous.

**`queries/reviews.ts`**
Exports: `insertReviewRequest`, `getReviewRequestById`, `getReviewRequestByGraphRunId`, `listPendingReviewRequests`, `resolveReviewRequest`. Synchronous. Returns cast to `ReviewRequest` type.

**`queries/health.ts`**
Exports: `dbHealthCheck`. Tries a simple select; returns `{ ok, database }`.

---

### AI (`src/lib/ai/`)

**`model.ts`**
Exports `getChatModel()`. Uses `ChatGoogleGenerativeAI` with `GOOGLE_API_KEY` (throws if missing) and `GOOGLE_MODEL` (default `gemini-2.5-flash`).

**`prompts.ts`**
Exports 7 prompt constants: `SYSTEM_PROMPT`, `RAG_SYSTEM_PROMPT`, `GRADE_CHUNKS_PROMPT`, `REWRITE_QUERY_PROMPT`, `VERIFY_GROUNDING_PROMPT`, `GROUNDED_ANSWER_PROMPT`, `AGENT_SYSTEM_PROMPT`.

---

### Graph State (`src/lib/graph/state.ts`)

Defines `ChatGraphAnnotation` (conversationId, userMessage, history, assistantMessage) and `ChatGraphState`. Used only by `main.graph.ts`; all other graphs define their own annotations inline.

---

### Graphs

**`main.graph.ts`**
Linear 4-node chat graph. Wraps each node with `withTrace`. Compiled to `mainChatGraph`.

**`rag.graph.ts`**
Defines `RagGraphAnnotation` (adds `topK`, `retrievedChunks`, `sources`). Linear 5-node RAG graph. Compiled to `ragChatGraph`.

**`agentChat.graph.ts`**
Defines `AgentChatAnnotation` (adds `sources`, `groundingStatus`, `usedDocuments`). Linear 4-node agent graph. Uses `as Parameters<typeof fn>[0]` casts to reuse shared nodes. Compiled to `agentChatGraph`.

**`selfRagChat.graph.ts`**
Outer self-RAG graph with HITL. Uses `MemorySaver` stored on `globalThis` for hot-reload safety. Conditional edges: `decideHumanReview` routes to `createReviewRequest` or `saveRagAssistantMessage`. Compiled with `{ checkpointer: memorySaver }`. `createReviewRequest` is intentionally unwrapped (avoids false-error traces from `interrupt()`).

**`subgraphs/selfRag.graph.ts`**
Inner self-RAG subgraph. Defines `SelfRagChatAnnotation` (conversationId, userMessage, history, assistantMessage, topK, activeQuery, retrievedChunks, relevantChunks, sources, retryCount, maxRetries, groundingStatus, reviewId, reviewDecision). Reads `SELF_RAG_TOP_K`, `SELF_RAG_MAX_RETRIES`, `SELF_RAG_MIN_RELEVANT_CHUNKS` from env at module load. Compiled to `selfRagSubgraph`.

---

### Graph Nodes (`src/lib/graph/nodes/`)

| File | Purpose |
|---|---|
| `loadConversation.ts` | Loads or creates conversation; populates `history` |
| `saveUserMessage.ts` | Inserts user message row |
| `saveAssistantMessage.ts` | Inserts assistant message row |
| `generateAnswer.ts` | Calls LLM with history + system prompt |
| `retrieveChunksNode.ts` | Embeds query, retrieves top-K chunks, builds `sources` array |
| `generateRagAnswer.ts` | Calls LLM with context chunks injected |
| `saveRagAssistantMessage.ts` | Inserts assistant message with `sources` in metadataJson |
| `agentGenerate.ts` | Tool-calling agent loop (single tool: `answerFromDocuments`) |
| `saveAgentAssistantMessage.ts` | Inserts agent assistant message with optional sources/grounding metadata |
| `selfRagRetrieve.ts` | Embeds active query, retrieves chunks, builds sources |
| `gradeRetrievedChunks.ts` | LLM grades which chunk IDs are relevant |
| `rewriteRagQuery.ts` | LLM rewrites user question as better search query |
| `generateGroundedAnswer.ts` | LLM generates answer using only relevant chunks |
| `verifyGrounding.ts` | LLM verifies answer is supported by source chunks |
| `honestFallback.ts` | Sets fixed fallback message if grounding fails |
| `decideHumanReview.ts` | Conditional router: routes to `'review'` if `groundingStatus='unsupported'` |
| `createReviewRequest.ts` | Inserts review row; calls LangGraph `interrupt()` |
| `applyReviewDecision.ts` | Resolves review in DB; sets final `assistantMessage` per decision |

---

### RAG (`src/lib/rag/`)

**`chunk.ts`**
`chunkText(text)` — fixed 1200-char chunks with 200-char overlap. No sentence-boundary awareness.

**`embeddings.ts`**
Lazy-init singleton `FeatureExtractionPipeline` from `@huggingface/transformers`. `embed(text)` returns `number[]` (mean-pooled, normalized). Model name from `EMBEDDING_MODEL` env var.

**`extractText.ts`**
`extractText(filePath, mimeType)` — routes to pdf-parse for PDFs or `fs.readFile` for text/markdown. Uses class-based API: `new PDFParse(...)`. **See Bug 2.**

**`retrieve.ts`**
`retrieveChunks(query, topK)` — loads ALL embeddings from DB, scores with cosine similarity, returns top-K. O(n) full-scan; no index.

**`similarity.ts`**
`cosineSimilarity(a, b)` — pure dot-product implementation. Returns 0 if denominator is 0. **See Bug 8.**

---

### Services (`src/lib/services/`)

**`chat.service.ts`**
- `sendMessage`: Non-streaming; invokes `mainChatGraph`
- `streamMessage`: SSE via `mainChatGraph.streamEvents`; forwards `on_chat_model_stream` tokens
- `streamRagMessage`: SSE via `ragChatGraph.streamEvents`; sends `sources` event when `retrieveChunksNode` ends
- `streamAgentMessage`: Uses `agentChatGraph.invoke` (not streamEvents) to suppress intermediate LLM outputs; sends all tokens at once
- `streamSelfRagMessage`: SSE via `selfRagChatGraph.streamEvents`; sends `status` events, pending sources before first token, detects interrupt via `getState()` and sends `{ type: 'review', reviewId }`

**`document.service.ts`**
`ingestDocument`: Validates type/size, writes file, inserts document row, extracts text, chunks, inserts chunk rows, updates status to `'ready'`.

**`review.service.ts`**
- `getPendingReviews`, `getReview`: Read-only
- `resumeGraph`: Calls `selfRagChatGraph.invoke(new Command({ resume: decision }), { configurable: { thread_id: review.graphRunId } })`
- `approveReview`, `rejectReview`, `editReview`: Wrap `resumeGraph`

---

### Observability (`src/lib/observability/`)

**`run.ts`**
`startRun(graphName, conversationId?, existingId?)` — inserts `graph_runs` row; returns `{ runId, finish, fail }` closures.

**`trace.ts`**
`withTrace(runId, nodeName, eventType, fn, compactInput?)` — times fn, inserts `trace_events` row on success or failure.

---

### Tools (`src/lib/tools/`)

**`answerFromDocuments.ts`**
`DynamicStructuredTool` with name `answer_from_documents`. Invokes `selfRagSubgraph` (the inner compiled subgraph, without checkpointer or HITL). Returns JSON `{ answer, sources, groundingStatus }`.

---

### Validation (`src/lib/validation/`)

**`chat.ts`**
`ChatRequestSchema` — Zod object with `message` (1–8000 chars) and optional `conversationId`.

---

### Types (`src/types/chat.ts`)

Exports: `ChatRequest`, `RetrievedChunk`, `Source`, `RagChatRequest`, `ChatResponse`, `ConversationSummary`, `MessageRecord`, `ReviewDecision`, `ReviewRequest`.

---

### API Routes

| Route | Method | Handler |
|---|---|---|
| `/api/chat` | POST | `sendMessage` — non-streaming |
| `/api/chat/stream` | POST | `streamMessage` — SSE, main chat |
| `/api/chat/rag/stream` | POST | `streamRagMessage` — SSE, basic RAG |
| `/api/chat/agent/stream` | POST | `streamAgentMessage` — SSE, agent chat |
| `/api/chat/self-rag/stream` | POST | `streamSelfRagMessage` — SSE, self-RAG with HITL |
| `/api/conversations` | GET | `listConversations` |
| `/api/conversations/[id]/messages` | GET | Conversation + messages array |
| `/api/documents` | POST/GET | Upload / list documents |
| `/api/documents/[id]` | GET | Document + chunks |
| `/api/documents/[id]/embed` | POST | Per-chunk embed loop (idempotent) |
| `/api/retrieval/test` | POST | Manual retrieval search |
| `/api/review` | GET | `listPendingReviewRequests` |
| `/api/review/[id]` | GET | Single review |
| `/api/review/[id]/approve` | POST | HITL approve |
| `/api/review/[id]/reject` | POST | HITL reject |
| `/api/review/[id]/edit` | POST | HITL edit |
| `/api/traces` | GET | Last 50 graph runs |
| `/api/traces/[id]` | GET | Run + events |
| `/api/db-health` | GET | Liveness probe |

---

### Pages

**`/` (`page.tsx`)**: Redirects to `/chat`.

**`/chat` (`chat/page.tsx`)**: Full chat UI — loads conversations, streams messages via the hardcoded agent endpoint, inline document upload with embed step, sources panel, status indicators (retrieving/rewriting/awaiting-review).

**`/documents` (`documents/page.tsx`)**: Server Component; lists all documents via direct DB query; renders `DocumentUploader`, `DocumentList`, `RetrievalTester`. `force-dynamic`.

**`/review` (`review/page.tsx`)**: Client Component; renders `ReviewQueue`.

**`/traces` (`traces/page.tsx`)**: Client Component; fetches runs from `/api/traces`, shows `TraceList` + `TraceDetail` side-by-side.

---

### Migrations (Drizzle)

| File | Creates |
|---|---|
| `0000_easy_calypso.sql` | `conversations`, `graph_runs`, `messages`, `trace_events` |
| `0001_lucky_molecule_man.sql` | `chunks`, `documents` |
| `0002_optimal_squadron_supreme.sql` | `embeddings` + unique index |
| `0003_regular_gunslinger.sql` | `review_requests` |

---

## 4. Bugs & Discrepancies

### Bug 1 — `.env.example` documents the wrong AI provider (CRITICAL)

**Files:** `.env.example`, `docs/ARCHITECTURE.md`

`.env.example` has `XAI_API_KEY=` and `XAI_MODEL=grok-4.3`. The code (`src/lib/ai/model.ts`) uses `ChatGoogleGenerativeAI` and requires `GOOGLE_API_KEY`. Anyone following the example file will get a startup crash:

```
Error: Missing required environment variable: GOOGLE_API_KEY
```

The `ARCHITECTURE.md` also still references the old `grok.ts` filename from the original xAI implementation.

**Fix:** Replace `.env.example` entries with `GOOGLE_API_KEY=` and `GOOGLE_MODEL=gemini-2.5-flash`. Update `ARCHITECTURE.md`.

---

### Bug 2 — `extractText.ts` uses incorrect `pdf-parse` API (CRITICAL)

**File:** `src/lib/rag/extractText.ts`

```typescript
import { PDFParse } from 'pdf-parse';
const parser = new PDFParse({ data: new Uint8Array(buffer) });
const result = await parser.getText();
```

The canonical `pdf-parse` v1.x API has a **default function export**, not a named class `PDFParse`. If the installed v2.4.5 does not export a named `PDFParse` class, this will throw `TypeError: PDFParse is not a constructor` at runtime, silently setting every uploaded PDF to `status='failed'`.

**Fix:** Verify the v2.4.5 export. If no named export exists, use:
```typescript
import pdfParse from 'pdf-parse';
const result = await pdfParse(buffer);
return result.text;
```

---

### Bug 3 — Self-RAG retry loop is inoperative due to fallback in `gradeRetrievedChunks` (HIGH)

**File:** `src/lib/graph/nodes/gradeRetrievedChunks.ts`

When the grader LLM returns `{"relevantChunkIds":[]}` (nothing relevant), the code falls back to the top-3 retrieved chunks anyway:

```typescript
const finalChunks = relevantChunks.length > 0 ? relevantChunks : state.retrievedChunks.slice(0, 3)
return { relevantChunks: finalChunks }
```

`decideContextQuality` in `selfRag.graph.ts` checks `state.relevantChunks.length >= MIN_RELEVANT_CHUNKS`. Because the fallback always produces ≥1 chunk (when any chunks were retrieved at all), the `rewriteRagQuery` branch is **never reached**. The entire self-RAG retry mechanism is inoperative.

**Fix:** Return `relevantChunks: []` when the grader returns empty. Let `decideContextQuality` route to the retry path.

---

### Bug 4 — `honestFallback` overwrites `assistantMessage` before HITL captures it (HIGH)

**Files:** `honestFallback.ts`, `createReviewRequest.ts`, `selfRagChat.graph.ts`

Flow: `verifyGrounding` → `honestFallback` (sets `assistantMessage = 'I could not find enough support...'`) → END of subgraph → outer `decideHumanReview` → `createReviewRequest` reads `state.assistantMessage` as `proposedOutput`.

The review queue always shows the fixed fallback string, never the actual (ungrounded) LLM answer. Human reviewers cannot evaluate the real AI response.

**Fix:** Either (a) capture the original answer in a separate state field before `honestFallback` runs, or (b) remove `honestFallback` from the subgraph and handle all unsupported cases via the HITL outer path.

---

### Bug 5 — In-memory `MemorySaver` loses HITL state on process restart (HIGH)

**File:** `src/lib/graph/selfRagChat.graph.ts`

```typescript
const g = globalThis as typeof globalThis & { __selfRagMemorySaver?: MemorySaver }
if (!g.__selfRagMemorySaver) g.__selfRagMemorySaver = new MemorySaver()
```

`MemorySaver` is RAM-only. If the Node process restarts (deploy, crash, scale-out) between a graph `interrupt()` and the human calling `/api/review/[id]/approve`, the checkpoint is gone. `selfRagChatGraph.invoke(new Command({ resume: decision }))` will throw; the graph run stays `status='running'` forever.

**Fix:** Replace with a persistent checkpointer, e.g., `SqliteSaver` from `@langchain/langgraph-checkpoint-sqlite`, backed by the same SQLite DB.

---

### Bug 6 — Chat page hardcodes the agent endpoint; three stream routes are unreachable from the UI (MEDIUM)

**File:** `src/app/chat/page.tsx`

```typescript
const endpoint = '/api/chat/agent/stream'
```

There is no mode selector. Routes `/api/chat/stream`, `/api/chat/rag/stream`, and `/api/chat/self-rag/stream` are fully functional but completely dead from the client — they can only be reached via direct API calls.

**Fix:** Add a mode selector dropdown to the chat UI with options: Standard, RAG, Agent, Self-RAG.

---

### Bug 7 — Internal error sentinel exposed to client via streaming (MEDIUM)

**File:** `src/lib/services/chat.service.ts`

```typescript
} catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  send({ type: 'error', message })
}
```

If `loadConversation` throws `Error('CONVERSATION_NOT_FOUND:abc123')`, the raw sentinel is sent over SSE and displayed to users. The non-streaming `/api/chat` route correctly maps this to a clean 404; streaming routes do not.

**Fix:** Check `message.startsWith('CONVERSATION_NOT_FOUND:')` in streaming error handlers and send a clean message.

---

### Bug 8 — `cosineSimilarity` has no vector-length guard (MEDIUM)

**File:** `src/lib/rag/similarity.ts`

```typescript
for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
```

If a stored embedding dimension count differs from the query (e.g., because `EMBEDDING_MODEL` was changed without re-embedding), `b[i]` will be `undefined` for out-of-range indices, producing `NaN` scores silently and corrupting retrieval ranking.

**Fix:** Add a guard: `if (a.length !== b.length) throw new Error(...)` or `return 0`.

---

### Bug 9 — Empty assistant bubble rendered simultaneously with `ThinkingIndicator` (MEDIUM)

**File:** `src/app/chat/page.tsx`

The code sets `loading = true`, then appends an empty assistant message. Both the empty bubble and the bouncing-dots indicator are visible simultaneously in the scroll area.

**Fix:** Append the empty assistant bubble only after the first token arrives, or make `ThinkingIndicator` conditional on the last message being empty.

---

### Bug 10 — `pdfjs-dist` in `serverExternalPackages` but not a dependency (LOW)

**File:** `next.config.ts`

`serverExternalPackages: ['pdf-parse', 'pdfjs-dist']` — `pdfjs-dist` does not appear in `package.json`. Harmless but misleading.

**Fix:** Remove `'pdfjs-dist'` from the array.

---

### Bug 11 — `countChunksByDocumentId` is dead code with an inefficient implementation (LOW)

**File:** `src/lib/db/queries/documents.ts`

The function is exported but never called anywhere. It also uses a select-all + `.length` count instead of SQL `COUNT(*)`.

**Fix:** Delete the function, or replace with `db.select({ count: sql<number>\`count(*)\` })...` if needed later.

---

### Bug 12 — UUID-prefixed filename shown to users after upload (LOW)

**Files:** `src/components/documents/DocumentUploader.tsx`, `src/lib/services/document.service.ts`

After upload, the success message shows the internal filename like `47dc443f-...-report.pdf` instead of the user's original filename.

**Fix:** Return and display `originalName` from the service response.

---

### Bug 13 — Duplicate `ALLOWED_TYPES`/`MAX_SIZE_BYTES` constants risk drift (LOW)

**Files:** `src/app/api/documents/route.ts`, `src/lib/services/document.service.ts`

Both files define identical validation constants. If one is updated and the other is not, the API route and the service will enforce different limits.

**Fix:** Extract both constants to a shared `src/lib/constants/documents.ts` and import from there.

---

### Bug 14 — Shared nodes narrowly typed to `ChatGraphState`; unsafe casts across all other graph types (LOW)

**Files:** `loadConversation.ts`, `saveUserMessage.ts`, `saveAssistantMessage.ts`

These nodes accept `ChatGraphState` from `state.ts`. Other graphs (RAG, agent, self-RAG) pass their richer state types using unsafe casts like `as Parameters<typeof loadConversation>[0]`. If any shared node accesses a field that doesn't exist on a richer state, TypeScript won't catch it at call sites.

**Fix:** Define a minimal `BaseChatState` interface (`{ conversationId?, userMessage, history, assistantMessage? }`) and have all graph state types extend it.

---

### Bug 15 — `saveRagAssistantMessage` typed to `RagGraphState` but used in `selfRagChatGraph` (LOW)

**Files:** `saveRagAssistantMessage.ts`, `selfRagChat.graph.ts`

Same structural mismatch as Bug 14. Works at runtime because the required fields exist on both state types, but is not verified by TypeScript.

---

### Bug 16 — LangSmith/Langfuse keys documented but never consumed (LOW)

**File:** `.env.example`

`LANGSMITH_API_KEY`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` appear in `.env.example` and likely in local `.env` files but no code reads them. The observability layer uses custom SQLite tables instead.

**Fix:** Remove these from `.env.example` or add a comment that they are reserved for future optional integration.

---

### Bug 17 — Empty directories mislead about project structure (LOW)

**Paths:** `src/lib/types/`, `src/lib/guardrails/`

`src/lib/types/` is empty; actual types live in `src/types/`. `src/lib/guardrails/` is a placeholder for a feature that doesn't exist. Both directories are misleading.

**Fix:** Delete `src/lib/types/` and add a comment in `ARCHITECTURE.md` that guardrails are planned but not yet implemented.

---

### Bug 18 — `agentGenerate` has no loop guard; tools bound during synthesis step (LOW)

**File:** `src/lib/graph/nodes/agentGenerate.ts`

The agent makes one round of tool calls then one synthesis call, but the LLM is still tool-bound during synthesis (same `model.bindTools()` instance used). If the model issues tool calls in the synthesis response they are silently ignored. There's also no max-iteration guard for multi-hop agent loops.

**Fix:** Either create a separate `modelWithoutTools = model.withConfig({...})` for the synthesis step or implement a proper `while (response.tool_calls.length > 0)` loop with an iteration cap.

---

### Bug 19 — Chat-page upload does not refresh the `/documents` page (LOW)

**File:** `src/app/chat/page.tsx`

After a successful upload from the chat page, `uploadStatus` is set to `'done'` but the `/documents` Server Component is not refreshed. Users must navigate there manually to confirm success.

**Fix:** Call `router.refresh()` from `next/navigation` after the embed step completes.

---

## 5. Bug Summary Table

| # | Severity | File(s) | Issue |
|---|---|---|---|
| 1 | **Critical** | `.env.example`, `ARCHITECTURE.md` | Wrong AI provider variables — `XAI_API_KEY`/`XAI_MODEL` instead of `GOOGLE_API_KEY`/`GOOGLE_MODEL` |
| 2 | **Critical** | `src/lib/rag/extractText.ts` | `pdf-parse` used as class (`new PDFParse(...)`) — runtime crash on all PDF uploads |
| 3 | **High** | `src/lib/graph/nodes/gradeRetrievedChunks.ts` | Fallback to top-3 when grader returns empty makes the Self-RAG retry loop inoperative |
| 4 | **High** | `selfRagChat.graph.ts`, `honestFallback.ts`, `createReviewRequest.ts` | `honestFallback` overwrites `assistantMessage` before HITL captures it; review always proposes fallback text |
| 5 | **High** | `src/lib/graph/selfRagChat.graph.ts` | In-memory `MemorySaver` — HITL graph state lost on process restart |
| 6 | **Medium** | `src/app/chat/page.tsx` | Endpoint hardcoded to agent stream; main/RAG/self-RAG routes are unreachable from UI |
| 7 | **Medium** | `src/lib/services/chat.service.ts` | Internal `CONVERSATION_NOT_FOUND:xxx` sentinel exposed to client via streaming |
| 8 | **Medium** | `src/lib/rag/similarity.ts` | No vector-length guard; model change without re-embedding produces NaN scores silently |
| 9 | **Medium** | `src/app/chat/page.tsx` | Empty assistant bubble rendered simultaneously with `ThinkingIndicator` |
| 10 | Low | `next.config.ts` | `pdfjs-dist` in `serverExternalPackages` but not a dependency |
| 11 | Low | `src/lib/db/queries/documents.ts` | `countChunksByDocumentId` — exported, never called, inefficient implementation |
| 12 | Low | `DocumentUploader.tsx`, `document.service.ts` | Shows UUID-prefixed internal filename to user instead of `originalName` |
| 13 | Low | `src/app/api/documents/route.ts`, `document.service.ts` | Duplicate `ALLOWED_TYPES`/`MAX_SIZE_BYTES` constants risk drift |
| 14 | Low | `loadConversation.ts`, `saveUserMessage.ts`, `saveAssistantMessage.ts` | Narrow `ChatGraphState` type with unsafe casts across all other graph types |
| 15 | Low | `saveRagAssistantMessage.ts`, `selfRagChat.graph.ts` | Typed to `RagGraphState`; used with `SelfRagChatState` |
| 16 | Low | `.env.example` | `LANGSMITH_API_KEY`, `LANGFUSE_*` keys documented but never consumed by any code |
| 17 | Low | `src/lib/types/`, `src/lib/guardrails/` | Empty directories — types in wrong place; guardrails planned but absent |
| 18 | Low | `src/lib/graph/nodes/agentGenerate.ts` | No loop guard; tools still bound during synthesis step |
| 19 | Low | `src/app/chat/page.tsx` | Upload in chat page doesn't trigger `/documents` page refresh |
