import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id')
    .notNull()
    .references(() => conversations.id),
  role: text('role').notNull(),
  content: text('content').notNull(),
  metadataJson: text('metadata_json'),
  createdAt: integer('created_at').notNull(),
});

export const graphRuns = sqliteTable('graph_runs', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').references(() => conversations.id),
  graphName: text('graph_name').notNull(),
  status: text('status').notNull(),
  startedAt: integer('started_at').notNull(),
  endedAt: integer('ended_at'),
  metadataJson: text('metadata_json'),
});

export const traceEvents = sqliteTable('trace_events', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => graphRuns.id),
  nodeName: text('node_name').notNull(),
  eventType: text('event_type').notNull(),
  inputJson: text('input_json'),
  outputJson: text('output_json'),
  latencyMs: integer('latency_ms'),
  error: text('error'),
  createdAt: integer('created_at').notNull(),
});

export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(),
  filename: text('filename').notNull(),
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type').notNull(),
  filePath: text('file_path').notNull(),
  status: text('status').notNull(),
  error: text('error'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const chunks = sqliteTable('chunks', {
  id: text('id').primaryKey(),
  documentId: text('document_id')
    .notNull()
    .references(() => documents.id),
  chunkIndex: integer('chunk_index').notNull(),
  content: text('content').notNull(),
  tokenCount: integer('token_count').notNull(),
  metadataJson: text('metadata_json'),
  createdAt: integer('created_at').notNull(),
});

export const embeddings = sqliteTable('embeddings', {
  id: text('id').primaryKey(),
  chunkId: text('chunk_id').notNull().references(() => chunks.id),
  model: text('model').notNull(),
  dimensions: integer('dimensions').notNull(),
  vectorJson: text('vector_json').notNull(),
  createdAt: integer('created_at').notNull(),
}, (t) => [uniqueIndex('embeddings_chunk_model_idx').on(t.chunkId, t.model)]);

export const reviewRequests = sqliteTable('review_requests', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => conversations.id),
  messageId: text('message_id'),
  graphRunId: text('graph_run_id').notNull(),
  reason: text('reason').notNull(),
  riskScore: integer('risk_score').notNull(),
  proposedOutput: text('proposed_output').notNull(),
  status: text('status').notNull(),
  humanFeedback: text('human_feedback'),
  editedOutput: text('edited_output'),
  createdAt: integer('created_at').notNull(),
  resolvedAt: integer('resolved_at'),
});
