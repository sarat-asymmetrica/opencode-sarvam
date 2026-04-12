// todo_add — append a new pending todo to the durable todo list.
//
// Why this exists: opencode's built-in todowrite takes an array parameter
// and Sarvam 105B cannot reliably produce JSON arrays as tool-call arguments.
// This tool takes a single string parameter — the text of one todo — which
// Sarvam handles trivially. Add todos one at a time, list them with
// todo_list, transition them with todo_start / todo_complete.
//
// The state survives context-window compaction because it lives on disk at
// .opencode/state/todos.json. That is the whole point: the agent's task
// plan becomes durable state, not ephemeral context.

import { tool } from "@opencode-ai/plugin"
import { loadState, saveState, type Todo } from "./todos_state"

export default tool({
  description: `Append a new todo item to the durable task list. Returns the assigned id.

Use this to externalize your task plan into disk-persisted state that survives context-window compaction. In long-horizon SWE-bench-style runs, the plan you hold in-memory is eaten by compaction events — the plan you write to disk via todo_add survives and can be re-read with todo_list after any compaction.

**Typical workflow**:
  1. At the start of a complex task, call todo_add several times (once per step)
  2. Before each step, call todo_start(id) to mark it in-progress
  3. After completing a step, call todo_complete(id)
  4. After any compaction (or at the start of any new turn), call todo_list() to re-ground your plan

The todo's status starts as "pending" (R1 — exploration). Use todo_start to move it to "in_progress" (R2 — optimization), and todo_complete to move it to "completed" (R3 — stabilization). Deletion is todo_clear (clears all) — there is no individual delete, because in a research workflow you want the full history preserved.

**Input format**: a single string describing the todo in one line. Keep it short and action-oriented. Examples:
  "Query GitNexus for context on the failing test"
  "Trace parse_sales_rows for the 2026-01-05 input"
  "Emit unified diff with the [0] -> [1] fix"
  "Run impact analysis on aggregate_by_month_and_category"

Do NOT try to pass multiple todos at once by joining them with newlines or commas. Call todo_add once per todo. This is by design — the array-input problem that broke opencode's built-in todowrite is exactly what this tool avoids.`,
  args: {
    text: tool.schema.string().describe(
      'The text of the single todo to add, e.g. "Query GitNexus for context on the failing test". One todo per call. Do not pass JSON arrays or newline-separated lists.'
    ),
  },
  async execute(args, context) {
    const text = (args.text ?? "").trim()
    if (text.length === 0) {
      throw new Error("todo text must not be empty")
    }
    if (text.length > 500) {
      throw new Error(
        `todo text too long (${text.length} chars). Keep todos under 500 characters — if you need more detail, create multiple todos.`
      )
    }

    const state = await loadState(context.directory)
    const newTodo: Todo = {
      id: state.next_id,
      text,
      status: "pending",
    }
    state.todos.push(newTodo)
    state.next_id = state.next_id + 1
    await saveState(context.directory, state)

    return `Added todo #${newTodo.id}: ${newTodo.text}\nTotal todos: ${state.todos.length}`
  },
})
