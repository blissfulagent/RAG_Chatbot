# SPEC — ChromaDB as the Vector Store

## Goal

Replace the brute-force SQLite cosine-similarity retrieval path with ChromaDB.
SQLite keeps everything it already owns except chunk content + embeddings used
for retrieval.

## Scope boundary

SQLite keeps: `conversations`, `messages`, `documents` (metadata/status),
`review_requests`, `graph_runs`, `trace_events`, LangGraph checkpoints.

ChromaDB takes over: chunk text, chunk embeddings, chunk metadata
(`documentId`, `filename`, `chunkIndex`, `sourceType`, `createdAt`), and
similarity search.

The `chunks` and `embeddings` SQLite tables/migrations are left in place but
stop being written/read by active code (per instructions — avoiding a
destructive migration). Their query helpers and `src/lib/rag/similarity.ts`
are deleted since nothing calls them once retrieval moves to Chroma.

## New module

`src/lib/vector/chroma.ts` — thin wrapper around `ChromaClient`:
- `upsertChunks(chunks)` — upsert `{ id, content, embedding, metadata }[]`
- `queryChunks(embedding, topK)` — returns `RetrievedChunk[]`
- `deleteDocumentChunks(documentId)` — delete by `where: { documentId }`
- Reads `CHROMA_URL` (host/port/ssl parsed from it) and `CHROMA_COLLECTION`
  from env. Collection created with `embeddingFunction: null` since embeddings
  are always supplied explicitly (local Xenova pipeline, unchanged).

## Ingestion flow (`document.service.ts`)

1. Save upload to disk, insert `documents` row with `status: 'uploading'`.
2. `extractText` → `chunkText` (unchanged, in-memory only — no SQLite insert).
3. Status → `'embedding'`.
4. Embed each chunk locally, `upsertChunks` into Chroma.
5. Status → `'ready'`. On any embed/Chroma error → `status: 'failed'`, error
   message stored.

`reembedDocument(id)`: re-extracts from the stored file, rechunks,
`deleteDocumentChunks(id)` then re-embeds + upserts. Repurposes the existing
`POST /api/documents/[id]/embed` route (manual re-embed trigger).

`deleteDocument(id)`: `deleteDocumentChunks(id)` in Chroma, deletes the
uploaded file, deletes the `documents` row. Wired to a new
`DELETE /api/documents/[id]` handler + a Delete button in `DocumentList`.

## Retrieval flow

`src/lib/rag/retrieve.ts`: embed query → `queryChunks(vector, topK)` →
returns `RetrievedChunk[]` with the same shape Self-RAG already expects.
`gradeRetrievedChunks` / `rewriteRagQuery` / `generateGroundedAnswer` /
`verifyGrounding` / HITL nodes are untouched.

`GET /api/documents/[id]` now previews chunks by reading them back from
Chroma (`collection.get({ where: { documentId } })`) instead of SQLite.

`/api/retrieval/test` calls the same `retrieveChunks` helper instead of
duplicating cosine-scan logic.

## Env vars

```
CHROMA_URL=http://localhost:8000
CHROMA_COLLECTION=modelchatter_documents
```

## Out of scope (per instructions)

No auth, no LangSmith/Langfuse, no hybrid search, no reranking, no new chat
modes, no changes to HITL decision logic, no destructive schema migration.
