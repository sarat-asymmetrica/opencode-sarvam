// Shared state management for the todo tool family.
//
// The 5 todo tools (todo_add, todo_start, todo_complete, todo_list, todo_clear)
// all read/write from a single JSON file at .opencode/state/todos.json.
//
// This file is deliberately simple because the goal is NOT to be a todo app —
// it's to provide externalized, durable, disk-persisted task state that
// survives context-window compaction. The agent writes todos during
// exploration and reads them back after compaction has eaten its in-memory
// plan. Durability > features.
//
// State format (JSON):
//   {
//     "todos": [
//       {"id": 1, "text": "Query GitNexus for context", "status": "pending"},
//       {"id": 2, "text": "Trace the buggy function", "status": "in_progress"},
//       {"id": 3, "text": "Emit unified diff", "status": "completed"}
//     ],
//     "next_id": 4
//   }
//
// Status values map to three-regime classification:
//   "pending"     = R1 (exploration — not yet started)
//   "in_progress" = R2 (optimization — actively working)
//   "completed"   = R3 (stabilization — done)

import { readFile, writeFile, mkdir } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { existsSync } from "node:fs"

export type TodoStatus = "pending" | "in_progress" | "completed"

export interface Todo {
  id: number
  text: string
  status: TodoStatus
}

export interface TodosState {
  todos: Todo[]
  next_id: number
}

const STATE_DIR = ".opencode/state"
const STATE_FILE = ".opencode/state/todos.json"

const EMPTY_STATE: TodosState = {
  todos: [],
  next_id: 1,
}

/** Resolve the state file path against a session's working directory. */
export function statePath(cwd: string): string {
  return resolve(cwd, STATE_FILE)
}

/** Load the current state from disk. Returns EMPTY_STATE if no file exists. */
export async function loadState(cwd: string): Promise<TodosState> {
  const path = statePath(cwd)
  if (!existsSync(path)) {
    return { todos: [], next_id: 1 }
  }
  const raw = await readFile(path, "utf8")
  try {
    const parsed = JSON.parse(raw)
    // Shallow validation — if the shape is wrong, fall back to empty
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      Array.isArray(parsed.todos) &&
      typeof parsed.next_id === "number"
    ) {
      return parsed as TodosState
    }
    return { todos: [], next_id: 1 }
  } catch {
    // Corrupted file — start fresh. This is the safest behavior for a
    // research tool where losing todo state is strictly less bad than
    // crashing the agent loop.
    return { todos: [], next_id: 1 }
  }
}

/** Save state to disk, creating directories as needed. */
export async function saveState(cwd: string, state: TodosState): Promise<void> {
  const path = statePath(cwd)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(state, null, 2), "utf8")
}

/** Format the current state as a human-readable list for inclusion in tool output. */
export function formatList(state: TodosState): string {
  if (state.todos.length === 0) {
    return "No todos. Use todo_add to create one."
  }
  const pending = state.todos.filter((t) => t.status === "pending")
  const inProgress = state.todos.filter((t) => t.status === "in_progress")
  const completed = state.todos.filter((t) => t.status === "completed")

  const lines: string[] = []

  if (inProgress.length > 0) {
    lines.push("=== IN PROGRESS (R2 — optimization) ===")
    for (const t of inProgress) {
      lines.push(`  [>] #${t.id}: ${t.text}`)
    }
    lines.push("")
  }

  if (pending.length > 0) {
    lines.push("=== PENDING (R1 — exploration) ===")
    for (const t of pending) {
      lines.push(`  [ ] #${t.id}: ${t.text}`)
    }
    lines.push("")
  }

  if (completed.length > 0) {
    lines.push("=== COMPLETED (R3 — stabilization) ===")
    for (const t of completed) {
      lines.push(`  [x] #${t.id}: ${t.text}`)
    }
    lines.push("")
  }

  lines.push(
    `Totals: ${inProgress.length} in_progress, ${pending.length} pending, ${completed.length} completed`
  )

  return lines.join("\n")
}
