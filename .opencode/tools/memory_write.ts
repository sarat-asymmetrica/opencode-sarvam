// memory_write — store a fact in durable memory that survives compaction.
//
// This is Clause 19 priority 1 in the CME v2.3 discipline: before querying
// the graph (priority 2) or reading files (priority 3), the agent should
// first check memory for relevant precedents. memory_write is how those
// precedents get into memory in the first place — the agent stores what
// it learned after each fix so future problems benefit from past experience.

import { tool } from "@opencode-ai/plugin"
import { loadMemory, saveMemory, type MemoryEntry } from "./memory_state"

export default tool({
  description: `Store a fact in durable memory. This is how you build up experience across problems.

After fixing a bug, resolving a test failure, or learning a pattern about the codebase, store it here:
  memory_write("In sales_report.py, date.split('-')[0] extracts the year, not the month. The month is at index [1]. Root cause: off-by-one in aggregate_by_month_and_category line 56.")

The fact will be stored on disk and survive context-window compaction. Future calls to memory_recall will find it when a similar bug or pattern comes up.

**What to store**:
  - Bug patterns: "In {codebase}, {function} had a {bug_type} caused by {root_cause}. Fix: {change}."
  - Codebase conventions: "This repo uses integer cents for currency, not float dollars."
  - Test patterns: "Tests in this repo use unittest, not pytest. Run from the module's own directory."
  - Architecture notes: "The pure core is in sales_report.py, the boundary layer is cli.py."
  - Tool discoveries: "gitnexus context --content returns full source inline, replacing 8+ Read calls."

**What NOT to store**:
  - Exact code snippets (they change — store the *pattern*, not the *bytes*)
  - Temporary debugging state (that goes in todo_add, not memory)
  - Things the graph already knows (use gitnexus for structural facts)

**Input**: a single string describing the fact. Keep it concrete and action-oriented. Under 500 characters. One fact per call.`,
  args: {
    fact: tool.schema.string().describe(
      'The fact to store in durable memory, e.g. "In aggregate_by_month_and_category, date.split(\'-\')[1] extracts the month. [0] is the year. Off-by-one bugs here affect all TestAggregation tests." Keep under 500 characters. One fact per call.'
    ),
  },
  async execute(args, context) {
    const fact = (args.fact ?? "").trim()
    if (fact.length === 0) {
      throw new Error("fact must not be empty")
    }
    if (fact.length > 500) {
      throw new Error(
        `fact too long (${fact.length} chars). Keep facts under 500 characters — concrete patterns, not full code listings.`
      )
    }

    const state = await loadMemory(context.directory)
    const entry: MemoryEntry = {
      id: state.next_id,
      fact,
      timestamp: new Date().toISOString(),
    }
    state.entries.push(entry)
    state.next_id = state.next_id + 1
    await saveMemory(context.directory, state)

    return `memory #${entry.id} stored (${state.entries.length} total)`
  },
})
