# Modelchatter

Production-style AI chatbot built with Next.js, LangGraph.js, Self-RAG, human-in-the-loop review, and local observability. Powered by Google Gemini and SQLite.

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 App Router |
| Language | TypeScript |
| Styling | Tailwind CSS |
| LLM | Google Gemini (`@langchain/google-genai`) |
| Streaming | Server-Sent Events (SSE) |
| Graph orchestration | LangGraph.js |
| Database | SQLite + Drizzle ORM (app data) + ChromaDB (vectors) |
| Embeddings | Xenova `all-MiniLM-L6-v2` (in-process) |
| Validation | Zod |
| Observability | Local SQLite trace tables |

## Features

- **Streaming chat** — token-by-token SSE responses
- **RAG** — document upload, chunking, embedding, ChromaDB similarity retrieval, source citations
- **Self-RAG subgraph** — chunk quality grading, query rewriting, answer grounding verification, honest fallback
- **Human-in-the-loop** — LangGraph interrupt/resume pattern; review queue UI at `/review`
- **Observability** — every graph run and key node logged to SQLite; viewer at `/traces`
## Setup

```bash
cd app
cp .env.example .env.local
# Set GOOGLE_API_KEY (required). Other values have working defaults.

pnpm install
pnpm db:migrate

# Start ChromaDB + Next.js together
pnpm dev:all
```

Open [http://localhost:3000](http://localhost:3000).

### Running Chroma and Next.js separately

`pnpm dev:all` runs both `pnpm dev:chroma` and `pnpm dev` concurrently (via
`concurrently`). Chroma is a separate process from Next.js — it is **not**
started automatically by `pnpm dev` alone, so if you run `pnpm dev` on its
own, start Chroma yourself first:

```bash
pip install chromadb
pnpm dev:chroma
# or: chroma run --host localhost --port 8000 --path ./data/chroma
# or: docker run -p 8000:8000 chromadb/chroma
```

Chunk embeddings persist to disk under `./data/chroma`, so they survive
restarts. Make sure `.env` contains:

```
CHROMA_URL=http://localhost:8000
CHROMA_COLLECTION=<collection_name>
```

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Home — navigation hub |
| `/chat` | Streaming chatbot (normal / RAG / Self-RAG modes) |
| `/documents` | Document upload and embedding |
| `/review` | Human review queue for flagged responses |
| `/traces` | Graph run observability logs |

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `GOOGLE_API_KEY` | Yes | — | Google API key for Gemini |
| `GOOGLE_MODEL` | No | `gemini-2.5-flash` | Model name |
| `DATABASE_URL` | No | `file:./data/modelchatter.sqlite` | SQLite path |
| `EMBEDDING_MODEL` | No | `Xenova/all-MiniLM-L6-v2` | Embedding model (downloaded on first use) |
| `CHROMA_URL` | No | `http://localhost:8000` | ChromaDB server URL (vector store) |
| `CHROMA_COLLECTION` | No | `modelchatter_documents` | ChromaDB collection name |
| `RETRIEVAL_TOP_K` | No | `5` | Chunks retrieved per RAG query |
| `SELF_RAG_TOP_K` | No | `5` | Chunks retrieved in Self-RAG |
| `SELF_RAG_MAX_RETRIES` | No | `1` | Max query-rewrite attempts |
| `SELF_RAG_MIN_RELEVANT_CHUNKS` | No | `1` | Min graded-relevant chunks before generating |
| `LANGSMITH_API_KEY` | No | — | Optional LangSmith tracing |
| `LANGFUSE_PUBLIC_KEY` | No | — | Optional Langfuse tracing |
| `LANGFUSE_SECRET_KEY` | No | — | Optional Langfuse tracing |

## Database

```bash
pnpm db:migrate    # Apply migrations
pnpm db:generate   # Regenerate after schema changes
pnpm db:studio     # Open Drizzle Studio
```

## Docs

- [Architecture](docs/ARCHITECTURE.md) — graphs, data flow, DB schema
- [Demo walkthrough](docs/DEMO.md) — end-to-end feature tour
- [Limitations](docs/LIMITATIONS.md) — known constraints and future work

## Phase Status

- [x] Phase 00 — Project scaffold
- [x] Phase 01 — SQLite persistence
- [x] Phase 02 — Basic Gemini chatbot
- [x] Phase 03 — Streaming responses
- [x] Phase 04 — Conversation persistence
- [x] Phase 05 — Document ingestion
- [x] Phase 06 — Retrieval over chunks
- [x] Phase 07 — Self-RAG subgraph
- [x] Phase 08 — Human-in-the-loop guardrail
- [x] Phase 09 — Observability
- [x] Phase 10 — Local observability UI
- [x] Phase 11 — README and final demo polish
