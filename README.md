# Modelchatter

A chatbot built to explore what a "real" LLM app looks like once you go past a basic chat wrapper — persistence, streaming, retrieval-augmented answers, self-checking generation, and a human review step for answers the model isn't confident about, all wired together with LangGraph and traced locally in SQLite.

## Overview

Most chatbot tutorials stop at "call the API and stream the response." Modelchatter goes further: it stores conversations so they survive a refresh, lets you upload documents and ask questions grounded in them, grades its own retrieved context before answering, rewrites the query if the context is weak, verifies whether its own answer is actually supported by the source material, and — if it still isn't confident — pauses execution and hands the response to a human reviewer instead of guessing.

The core idea is a single LangGraph agent (`agentChatGraph`) that decides per-message whether a question needs document lookup at all. General-knowledge questions get answered directly; document-shaped questions trigger a Self-RAG subgraph (retrieve → grade → rewrite-if-weak → generate → verify grounding) before the answer reaches the user. Every run and every node execution is logged to SQLite so you can open `/traces` and see exactly what the graph did, in what order, with what latency.

Everything — frontend, API routes, graph orchestration, database access, and observability — lives in one Next.js app.

## Key Features

- **Streaming chat** over SSE, token by token, backed by Google Gemini (`@langchain/google-genai`)
- **Conversation persistence** — messages and conversations are stored in SQLite and reload on refresh
- **Document ingestion** — upload PDF or text files, extract text, chunk it, embed it locally with `Xenova/all-MiniLM-L6-v2`, and store the vectors in ChromaDB
- **Retrieval-augmented answers** with cited source chunks shown in the UI
- **Self-RAG subgraph** — grades retrieved chunks for relevance, rewrites the query and retries if context is weak, generates an answer, then verifies whether that answer is actually grounded in the retrieved text before returning it
- **Unified agent routing** — one graph decides whether a given message needs document retrieval or can be answered directly, instead of the user having to pick a "mode"
- **Human-in-the-loop review** — when an answer comes back ungrounded, the graph pauses via LangGraph's `interrupt()`, creates a review request, and waits for a human to approve, reject, or edit it at `/review` before resuming
- **Local observability** — every graph run and every node execution is recorded (inputs, outputs, latency, errors) and viewable at `/traces`, no external tracing service required

## Architecture / Workflow

The whole app runs as one Next.js project. There's no separate backend service.

```
Browser (chat UI)
  → POST /api/chat/agent/stream
      chat.service.ts creates a graph_runs row
      → agentChatGraph runs:
          loadConversation → saveUserMessage → agentGenerate → [decideHumanReview]
      agentGenerate binds an `answer_from_documents` tool to the model.
      For document-shaped questions, that tool runs the Self-RAG subgraph:
          selfRagRetrieve → gradeRetrievedChunks
            → (weak context) rewriteRagQuery → selfRagRetrieve  [retry loop]
            → (good context) generateGroundedAnswer → verifyGrounding
                → supported     → return answer + sources
                → unsupported   → honestFallback
      For general-knowledge questions, the model just answers — no tool call.
      → decideHumanReview checks groundingStatus:
          no_review → saveAgentAssistantMessage → done
          review    → createReviewRequest (interrupt, graph pauses here)
                        → [human resolves via /api/review/[id]/approve|reject|edit]
                        → applyReviewDecision → saveAgentAssistantMessage → done
  ← SSE stream: status events, source citations, tokens, then a done/review event
```

Two older graphs (`mainChatGraph`, `ragChatGraph`, `selfRagChatGraph`) and their routes (`/api/chat/stream`, `/api/chat/rag/stream`, `/api/chat/self-rag/stream`) still exist from earlier build phases and still work, but the chat page (`/chat`) only calls `/api/chat/agent/stream` now — the unified agent graph is what's actually in use.

Document data flow:

```
POST /api/documents           → store file, create documents row (status: pending)
POST /api/documents/[id]/embed → extract text (pdf-parse / plain text)
                                 → chunk with overlap
                                 → embed each chunk (Xenova/all-MiniLM-L6-v2, 384-dim, in-process)
                                 → upsert into ChromaDB (text + vector + metadata)
                                 → documents row set to status: ready (or failed)
```

Retrieval at query time embeds the user's question and runs a similarity search against the ChromaDB collection, returning the same chunk shape both the basic RAG graph and the Self-RAG subgraph expect.

Observability wraps this everywhere: `startRun()` opens a `graph_runs` row before the graph executes, every node is wrapped in `withTrace()` which writes a `trace_events` row (input, output, latency, error), and the run is marked success or failed when it finishes. The one exception is `createReviewRequest`, which is deliberately left untraced because it calls LangGraph's `interrupt()` — a control-flow throw, not a real error — that would otherwise show up as a false failure in the trace log.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| UI | React 19 + Tailwind CSS 4 |
| LLM | Google Gemini via `@langchain/google-genai` |
| Graph orchestration | LangGraph.js (`@langchain/langgraph`) |
| Streaming | Server-Sent Events, hand-rolled over `streamEvents()` |
| App database | SQLite via `better-sqlite3` + Drizzle ORM |
| Vector store | ChromaDB (external process) |
| Embeddings | `Xenova/all-MiniLM-L6-v2` via `@huggingface/transformers`, run in-process |
| Document parsing | `pdf-parse` |
| Validation | Zod |
| Graph checkpointing | `@langchain/langgraph-checkpoint-sqlite` |

## Project Structure

```
app/
├── drizzle/                        # SQL migrations (Drizzle Kit)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/agent/stream/  # POST — unified agent graph, what the UI actually calls
│   │   │   ├── chat/stream/        # POST — plain chat graph (no retrieval), earlier phase
│   │   │   ├── chat/rag/stream/    # POST — basic RAG graph, earlier phase
│   │   │   ├── chat/self-rag/stream/ # POST — Self-RAG-only graph, earlier phase
│   │   │   ├── conversations/      # list conversations, fetch a conversation's messages
│   │   │   ├── documents/          # upload, embed, delete documents
│   │   │   ├── review/             # list + approve/reject/edit review requests
│   │   │   ├── traces/             # list graph runs, fetch one run's trace events
│   │   │   └── retrieval/test/     # ad-hoc endpoint for testing retrieval quality
│   │   ├── chat/                   # main chat UI
│   │   ├── documents/              # upload + manage documents UI
│   │   ├── review/                 # human review queue UI
│   │   └── traces/                 # observability viewer UI
│   ├── components/                 # chat, documents, review, traces UI components
│   ├── lib/
│   │   ├── ai/                     # model.ts (Gemini client), prompts.ts
│   │   ├── db/                     # Drizzle schema + query modules per table
│   │   ├── graph/
│   │   │   ├── nodes/              # one file per LangGraph node
│   │   │   ├── subgraphs/          # selfRag.graph.ts
│   │   │   ├── checkpointer.ts     # shared SqliteSaver used for HITL pause/resume
│   │   │   └── *.graph.ts          # graph definitions (main, rag, selfRagChat, agentChat)
│   │   ├── observability/          # run.ts, trace.ts — graph_runs / trace_events writers
│   │   ├── rag/                    # chunk.ts, embeddings.ts, extractText.ts, retrieve.ts
│   │   ├── vector/                 # chroma.ts — ChromaDB client wrapper
│   │   ├── services/               # chat.service.ts, document.service.ts, review.service.ts
│   │   └── guardrails/             # placeholder — no dedicated guardrail subgraph yet
│   └── types/                      # shared TypeScript types
└── docs/                           # ARCHITECTURE.md, DEMO.md, LIMITATIONS.md
```

## Setup and Installation

Requires Node.js, [pnpm](https://pnpm.io/), and Python with `chromadb` installed (for the vector store process).

```bash
cd app
cp .env.example .env.local
```

Set these in `.env.local`:

```
GOOGLE_API_KEY=            # required — Gemini API key
GOOGLE_MODEL=gemini-2.5-flash
DATABASE_URL=file:./data/modelchatter.sqlite
EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2
CHROMA_URL=http://localhost:8000
CHROMA_COLLECTION=modelchatter_documents
RETRIEVAL_TOP_K=5
SELF_RAG_TOP_K=5
SELF_RAG_MAX_RETRIES=1
SELF_RAG_MIN_RELEVANT_CHUNKS=1
```

`LANGSMITH_API_KEY`, `LANGFUSE_PUBLIC_KEY`, and `LANGFUSE_SECRET_KEY` are also present in `.env.example` but reserved for future use — no integration code reads them yet.

Install and run:

```bash
pnpm install
pnpm db:migrate

# starts ChromaDB and Next.js together
pnpm dev:all
```

If you'd rather run them separately, `pnpm dev:all` is just `concurrently` wrapping `pnpm dev:chroma` and `pnpm dev`. Chroma is not started automatically by `pnpm dev` alone:

```bash
pip install chromadb
pnpm dev:chroma
# or: chroma run --host localhost --port 8000 --path ./data/chroma
```

Then open [http://localhost:3000](http://localhost:3000).

Other useful scripts:

```bash
pnpm db:generate   # regenerate a migration after editing src/lib/db/schema.ts
pnpm db:studio     # open Drizzle Studio to browse the SQLite DB
pnpm lint          # ESLint
pnpm build         # production build
```

## Usage

- `/chat` — the main chat UI. Type a message and it streams back token by token. Ask about a general topic and the model answers directly; ask about something in an uploaded document and it retrieves, grades, and grounds the answer automatically — there's no mode switch to pick.
- `/documents` — upload a PDF or text file, then trigger embedding. Uploaded files land in `uploads/`; extracted chunks and vectors go into ChromaDB (`data/chroma`), not the SQLite DB.
- `/review` — if an answer comes back ungrounded, it shows up here. Approve it as-is, reject it (returns a refusal), or edit the text before it's sent to the user. Resolving a request resumes the paused graph from its checkpoint.
- `/traces` — every chat request shows up as a run here, with per-node timing and I/O so you can see exactly what the graph did and where time went.

API surface, for reference:

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/chat/agent/stream` | POST | Unified agent chat (what the UI uses) |
| `/api/chat/stream` | POST | Plain chat, no retrieval (earlier phase, still functional) |
| `/api/chat/rag/stream` | POST | Basic RAG chat (earlier phase, still functional) |
| `/api/chat/self-rag/stream` | POST | Self-RAG-only chat (earlier phase, still functional) |
| `/api/documents` | POST | Upload a document |
| `/api/documents/[id]/embed` | POST | Extract, chunk, and embed a document |
| `/api/documents/[id]` | DELETE | Remove a document and its chunks |
| `/api/review` | GET | List pending review requests |
| `/api/review/[id]/approve` \| `reject` \| `edit` | POST | Resolve a review request |
| `/api/traces` | GET | List recent graph runs |
| `/api/traces/[id]` | GET | Run detail with all trace events |

## Implementation Details

**Unified routing via tool binding.** Rather than a mode dropdown, `agentGenerate` binds a single `answer_from_documents` tool to the Gemini model. The model itself decides, per message, whether the question needs document context. If it calls the tool, that tool runs the full Self-RAG subgraph internally and returns `{ answer, sources, groundingStatus }`; if it doesn't, the model just answers and `groundingStatus` stays undefined.

**Self-RAG loop.** `gradeRetrievedChunks` asks the model to judge each retrieved chunk for relevance. If too few chunks pass (`SELF_RAG_MIN_RELEVANT_CHUNKS`), `rewriteRagQuery` asks the model to reformulate the question and retries retrieval, up to `SELF_RAG_MAX_RETRIES` times. Once there's enough relevant context, `generateGroundedAnswer` produces a draft and `verifyGrounding` asks the model a second time whether that draft is actually supported by the chunks it was given — this is a separate LLM call from generation, not just trusting the first pass.

**Shared HITL logic across graphs.** `decideHumanReview`, `createReviewRequest`, and `applyReviewDecision` are written once against a structural `ReviewableChatState` interface (`graph/nodes/reviewable.ts`) and reused by both `agentChatGraph` and `selfRagChatGraph`. Both share a single `SqliteSaver` checkpointer keyed by `thread_id`, so a paused run can be resumed regardless of which graph created it — `review.service.ts` looks up the originating graph name from the `graph_runs` row to know which compiled graph to resume.

**In-process embeddings.** Chunk and query embeddings are computed with `@huggingface/transformers` running `Xenova/all-MiniLM-L6-v2` directly inside the Next.js process — no separate embedding service. The model (~80MB) downloads on first use, so the first embed call after a cold start is noticeably slower than subsequent ones.

**Vector storage split.** SQLite (via Drizzle) holds structured app state — conversations, messages, document metadata, review requests, graph runs, and trace events. Chunk text, embeddings, and retrieval metadata live entirely in ChromaDB. The `chunks` and `embeddings` SQLite tables and their migrations still exist from an earlier design but are no longer written to or read from — left in place rather than dropped, to avoid a destructive migration.

## Results / Outputs

Everything the app produces is queryable inside the app itself rather than exported as static artifacts:

- Conversations and messages persist in `data/modelchatter.sqlite` and survive a browser refresh.
- Document chunks and their vectors persist in `data/chroma`.
- Uploaded source files are kept in `uploads/`.
- Every chat request produces a `graph_runs` row and a handful of `trace_events` rows, viewable at `/traces` — this is the closest thing to a log/metrics output the project has right now.

There's no benchmark suite or accuracy numbers — retrieval quality can be spot-checked manually through the `/api/retrieval/test` endpoint and the `RetrievalTester` component under `/documents`, but nothing automated grades answer quality yet.

## Limitations / Future Improvements

- No automated evaluation harness for RAG or Self-RAG answer quality — a spec exists for this (`specs/phase-11-evaluation-harness.md`) but it was never built; `RetrievalTester` is a manual, ad-hoc substitute.
- `src/lib/guardrails/` is an empty placeholder. Guardrail/escalation logic currently lives inline in `decideHumanReview` rather than as its own subgraph.
- Human review has no push mechanism — after a request pauses for review, the chat UI shows "awaiting review" but doesn't get notified when it's resolved; the user has to reload the conversation.
- No authentication or per-user scoping — all conversations and review requests are visible to anyone with access to the app.
- Embeddings run in-process and block the event loop while computing; under real load this should move to a separate worker or service.
- `graph_runs` and `trace_events` grow unbounded — there's no retention policy or cleanup job.
- LangSmith/Langfuse environment variables are present but unused; if you want managed tracing on top of the local SQLite traces, that integration still needs to be written.

## Why This Project

This isn't a chatbot demo that stops at "stream tokens from an API." It's an attempt to build the parts that make an LLM feature trustworthy enough to ship: grounding verification instead of blind generation, a real escalation path to a human when the model isn't sure, and enough tracing to debug a bad answer after the fact instead of guessing. The interesting engineering problem here was less "call the LLM" and more "know when not to trust what it just said, and have a graph structure that can pause, wait for a person, and resume cleanly."
