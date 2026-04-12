// todo_list — read the current todo list as a formatted string.
//
// This is the tool the agent should call FIRST after any context-window
// compaction event, and at the start of any new turn in a long-horizon
// task. The formatted output shows todos grouped by status (in_progress,
// pending, completed) so the agent can re-ground its plan in one call.
//
// Takes ZERO parameters. This is by design — the simpler the signature,
// the more reliably Sarvam (or any mid-sized model) will call it correctly.

import { tool } from "@opencode-ai/plugin"
import { loadState, formatList } from "./todos_state"

export default tool({
  description: `Show the current todo list as a formatted string. Takes NO parameters. This is your re-grounding tool after any context-window compaction — call it first on any new turn in a long-horizon task to rediscover your plan.

The output groups todos by status:
  - IN PROGRESS (R2 — optimization): what you are actively working on
  - PENDING (R1 — exploration): what's next
  - COMPLETED (R3 — stabilization): what's done (kept as history)

Each todo shows its numeric id so you can pass the id to todo_start or todo_complete. If the list is empty, the output will say so explicitly.

**Typical use**:
  - Start of any new turn → call todo_list to see current plan
  - After a compaction event → call todo_list to re-ground
  - Before deciding your next action → call todo_list to confirm what step you're on
  - After completing a step → call todo_list to confirm progress and choose next

Do NOT pass any arguments to this tool. It takes no parameters. Calling it with any argument will still work (the arg will be ignored) but it is cleaner to call it bare.`,
  args: {},
  async execute(_args, context) {
    const state = await loadState(context.directory)
    return formatList(state)
  },
})
