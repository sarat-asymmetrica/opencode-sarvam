// memory_recall — search durable memory for relevant facts.
//
// This is the tool the agent should call FIRST per Clause 19 priority 1
// before querying the graph or reading files. It returns the top-5 facts
// from memory whose text matches the query's significant words.
//
// MVP retrieval is simple substring matching (word-level). The upgrade
// path to Memori's full semantic search replaces only the recall()
// function in memory_state.ts — the tool interface stays the same.

import { tool } from "@opencode-ai/plugin"
import { loadMemory, recall } from "./memory_state"

export default tool({
  description: `Search durable memory for facts relevant to a query. Returns the top 5 matching facts.

This is Clause 19 priority 1 — call this BEFORE querying GitNexus (priority 2) or reading files (priority 3). If memory returns a relevant precedent ("I fixed a similar off-by-one in this repo last session"), follow it. If memory is empty or has no match, fall through to the next oracle priority.

**Typical queries**:
  "date parsing off-by-one" → finds facts about date.split index bugs
  "currency precision float" → finds facts about integer-cents conventions
  "aggregate function callers" → finds facts about blast radius patterns
  "test runner convention" → finds facts about unittest vs pytest choices

**How retrieval works** (MVP):
  - Your query is split into significant words (length >= 4 characters)
  - Each stored fact is scored by how many query words appear in its text
  - Top 5 scored results are returned, sorted by relevance
  - If no words match any fact, the 5 most recent facts are returned instead

**When memory is empty**: at the start of a fresh session, memory has no entries. The recall will return "No memories stored yet." This is fine — fall through to the graph (priority 2). As you solve problems and call memory_write to store what you learned, future recalls become richer.

**Input**: a natural language query string describing what you're looking for. Keep it short and keyword-oriented — "date parsing month year split" is better than "I need to understand how dates are parsed in this codebase".`,
  args: {
    query: tool.schema.string().describe(
      'A natural language query to search memory for, e.g. "date parsing off-by-one" or "currency precision float". Keyword-oriented queries work best.'
    ),
  },
  async execute(args, context) {
    const query = (args.query ?? "").trim()
    if (query.length === 0) {
      throw new Error("query must not be empty")
    }

    const state = await loadMemory(context.directory)

    if (state.entries.length === 0) {
      return "No memories stored yet. This is expected at the start of a fresh session. Fall through to Clause 19 priority 2 (GitNexus graph query)."
    }

    const results = recall(state, query)

    if (results.length === 0) {
      return `No memories matched query "${query}". Total memories: ${state.entries.length}. Fall through to Clause 19 priority 2 (GitNexus graph query).`
    }

    const lines: string[] = [
      `Found ${results.length} relevant memories for "${query}":`,
      "",
    ]
    for (const entry of results) {
      lines.push(`  #${entry.id} [${entry.timestamp}]: ${entry.fact}`)
    }
    lines.push("")
    lines.push(`Total memories in store: ${state.entries.length}`)

    return lines.join("\n")
  },
})
