import 'server-only'
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite'
import { sqlite } from '../db'

const g = globalThis as typeof globalThis & { __graphCheckpointer?: SqliteSaver }
if (!g.__graphCheckpointer) g.__graphCheckpointer = new SqliteSaver(sqlite)

export const checkpointer = g.__graphCheckpointer
