// todo_start — mark a pending todo as in_progress.
//
// See todos_state.ts and todo_add.ts for the broader design. This tool is
// the R1 -> R2 transition (exploration -> optimization) on the three-regime
// status model used by the todo list.

import { tool } from "@opencode-ai/plugin"
import { loadState, saveState } from "./todos_state"

export default tool({
  description: `Mark a pending todo as in_progress. This is how you signal 'I am actively working on this step now'. Call this BEFORE the tool calls that actually execute the step — the in_progress marker is a breadcrumb that says, after compaction or mid-debug, which step was the last thing you were doing.

**Status transitions**:
  pending (R1) → in_progress (R2) via todo_start
  in_progress (R2) → completed (R3) via todo_complete

Calling todo_start on a todo that is already in_progress is a no-op (safe). Calling it on a completed todo moves it back to in_progress (useful if you realize the work isn't actually done).

**Input format**: the numeric id of the todo, as returned by todo_add or visible in todo_list. Example:
  id = 3`,
  args: {
    id: tool.schema.number().describe(
      "The numeric id of the todo to mark as in_progress, e.g. 3. Get ids from todo_add (which returns the assigned id) or todo_list (which shows ids inline)."
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
    todo.status = "in_progress"
    await saveState(context.directory, state)

    return `Todo #${id} status: ${previous} → in_progress\nText: ${todo.text}`
  },
})
