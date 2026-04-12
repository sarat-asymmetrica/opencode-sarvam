// todo_clear — clear the entire todo list.
//
// Use sparingly. The default behavior is to preserve history — completed
// todos remain visible in todo_list as breadcrumbs. todo_clear wipes
// everything and resets the id counter. Useful between distinct tasks,
// at the start of a new session, or if the list has become unwieldy.
//
// Takes a confirm string so the model must pass the literal word "yes"
// to perform the clear. This guards against accidental wipes.

import { tool } from "@opencode-ai/plugin"
import { saveState } from "./todos_state"

export default tool({
  description: `Clear the entire todo list — removes all todos and resets the id counter to 1. **Destructive and rarely needed.** The default behavior of the todo system is to preserve history (completed todos stay visible in todo_list). todo_clear is only for between-task resets or when starting a fresh session.

**Confirmation required**: you must pass the literal string "yes" as the confirm argument. This prevents accidental wipes from fuzzy prompt interpretation. If you pass anything other than "yes", the clear is rejected.

**When to use**:
  - Starting a new distinct task unrelated to the current todo list
  - At the beginning of a session where the list is stale
  - Recovering from a corrupted state (though loadState handles this automatically)

**When NOT to use**:
  - To clean up "old" completed todos — they are kept on purpose as history
  - Between steps of the same task — you want the breadcrumbs
  - Just because the list looks long — length is not a reason to clear`,
  args: {
    confirm: tool.schema.string().describe(
      'Must be the literal string "yes" to perform the clear. Any other value rejects the operation.'
    ),
  },
  async execute(args, context) {
    const confirm = (args.confirm ?? "").trim().toLowerCase()
    if (confirm !== "yes") {
      throw new Error(
        `todo_clear requires confirm="yes" to execute. Got confirm=${JSON.stringify(args.confirm)}. Aborting — no changes made.`
      )
    }

    await saveState(context.directory, { todos: [], next_id: 1 })
    return `Todo list cleared. Ready for fresh task.`
  },
})
