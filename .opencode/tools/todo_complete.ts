// todo_complete — mark a todo as completed.
//
// This is the R2 -> R3 transition (optimization -> stabilization). Call this
// AFTER the tool calls that actually finished the step. The completed state
// is preserved in the todo list as a history breadcrumb — we do not delete
// completed todos by default because the history itself is valuable state.

import { tool } from "@opencode-ai/plugin"
import { loadState, saveState } from "./todos_state"

export default tool({
  description: `Mark a todo as completed. This is how you signal 'this step is done, no more work needed here'. Call this AFTER the tool calls that actually finished the work — completing a todo before the work is done is a discipline violation.

**Status transitions**:
  in_progress (R2) → completed (R3) via todo_complete
  pending (R1) → completed (R3) — allowed but unusual (means you skipped the in_progress marker)

Completed todos remain visible in todo_list as history. They do not vanish. If you want to see only pending and in_progress items, scan the todo_list output and ignore the COMPLETED section. The history is valuable research state — it shows what was done in what order.

**Input format**: the numeric id of the todo. Example:
  id = 3`,
  args: {
    id: tool.schema.number().describe(
      "The numeric id of the todo to mark as completed, e.g. 3. Get ids from todo_add or todo_list."
    ),
  },
  async execute(args, context) {
    const id = args.id
    if (typeof id !== "number" || !Number.isInteger(id) || id < 1) {
      throw new Error(`id must be a positive integer, got ${JSON.stringify(id)}`)
    }

    const state = await loadState(context.directory)
    const todo = state.todos.find((t) => t.id === id)
    if (!todo) {
      const existing = state.todos.map((t) => `#${t.id}`).join(", ") || "(none)"
      throw new Error(
        `No todo with id ${id}. Existing ids: ${existing}. Use todo_list to see current state.`
      )
    }

    const previous = todo.status
    todo.status = "completed"
    await saveState(context.directory, state)

    const done = state.todos.filter((t) => t.status === "completed").length
    return `#${id} ✓ (${done}/${state.todos.length} done)`
  },
})
