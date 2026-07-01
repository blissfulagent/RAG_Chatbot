# Limitations

Known constraints in the current implementation and notes on future work.

---

## Embeddings

**In-process model loading** — `Xenova/all-MiniLM-L6-v2` runs via `@huggingface/transformers` inside the Next.js Node.js process. The model (~80MB) is downloaded on first use and cached. This means:
- The first embed request after a cold start takes 10–30 seconds
- Embedding is CPU-bound and blocks the Node.js event loop during computation
- In production, this should move to a dedicated embedding service or worker

**O(n) similarity search** — Embeddings are stored as JSON strings in SQLite. Retrieval loads all embeddings into memory and computes cosine similarity pairwise. This works for hundreds of chunks but will not scale to thousands. A proper ANN index (e.g., sqlite-vec, pgvector, Pinecone) would replace this.

---

## Self-RAG

**Shallow retry loop** — `SELF_RAG_MAX_RETRIES` defaults to `1`. After one query rewrite, the system generates an answer regardless of chunk relevance. Increasing retries improves recall at the cost of latency.

**Low relevance threshold** — `SELF_RAG_MIN_RELEVANT_CHUNKS` defaults to `1`. The system proceeds to answer generation if even one graded-relevant chunk exists. Raising this to `2` or `3` improves answer quality when documents are noisy.

**Grounding and grading via Grok** — The chunk grader (`gradeRetrievedChunks`) and grounding verifier (`verifyGrounding`) both call the LLM. This adds 2–4 extra API calls per Self-RAG request compared to basic RAG.

---

## Human Review (HITL)

**Streaming stops at interrupt** — When `createReviewRequest` calls LangGraph `interrupt()`, the SSE stream ends and the client receives `{ type:'review', reviewId }`. There is no real-time notification when the review is resolved — the user must poll or check the review page.

**No re-streaming after resume** — After a human approves/edits/rejects, `applyReviewDecision` runs and saves the final message to the DB, but the original chat session does not receive a push notification. The user needs to reload conversation history.

**Single reviewer** — There is no auth or role system. Any user who can access `/review` can resolve any pending request.

---

## Observability

**No TTL or pruning** — `graph_runs` and `trace_events` rows accumulate indefinitely. Long-running deployments will need a cleanup job or a retention policy.

**createReviewRequest not traced** — This node is intentionally excluded from `withTrace()` because it calls LangGraph `interrupt()`, which throws a special control-flow error that would appear as a false failure in the trace log.

**Output truncation** — `withTrace()` stores the full return value of each node as JSON. Nodes that return large objects (e.g., full chunk arrays) can produce large `outputJson` blobs. Consider adding a size cap in `trace.ts`.

---

## Not Implemented

| Feature | Notes |
|---------|-------|
| Authentication | No user accounts; all conversations and reviews are shared |
| LangSmith / Langfuse / OpenTelemetry | API keys are wired in `.env.example` but no integration code exists |
| Streaming after HITL resume | The UI receives a `{ type:'review' }` event and stops — no push on resolution |
| Multi-tenant conversations | All conversations are in the same DB with no user scoping |
| Chunk deduplication | Re-embedding the same document creates duplicate chunk/embedding rows |
| Document deletion cascade | Deleting a document does not delete its chunks or embeddings |
| Rate limiting | No request throttling on any API route |
| Error recovery UI | Stream errors show a console message; no in-UI retry mechanism |
