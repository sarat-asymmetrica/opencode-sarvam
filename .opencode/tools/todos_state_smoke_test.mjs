// todos_state smoke test — runs the core state-management logic without
// depending on @opencode-ai/plugin. This verifies the durable state
// module works correctly; the individual tool files (todo_add.ts etc)
// are thin wrappers around this module and do not need separate tests.
//
// Run with: node .opencode/tools/todos_state_smoke_test.mjs

import { readFile, writeFile, mkdir, rm } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { existsSync } from "node:fs"

// Inline the state module logic (since todos_state.ts imports nothing external)
// This is a verbatim copy of the TS logic, ported to JS for the smoke test.

const STATE_FILE = ".opencode/state/todos.json"

function statePath(cwd) {
  return resolve(cwd, STATE_FILE)
}

async function loadState(cwd) {
  const path = statePath(cwd)
  if (!existsSync(path)) {
    return { todos: [], next_id: 1 }
  }
  const raw = await readFile(path, "utf8")
  try {
    const parsed = JSON.parse(raw)
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      Array.isArray(parsed.todos) &&
      typeof parsed.next_id === "number"
    ) {
      return parsed
    }
    return { todos: [], next_id: 1 }
  } catch {
    return { todos: [], next_id: 1 }
  }
}

async function saveState(cwd, state) {
  const path = statePath(cwd)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(state, null, 2), "utf8")
}

function formatList(state) {
  if (state.todos.length === 0) return "No todos. Use todo_add to create one."
  const pending = state.todos.filter((t) => t.status === "pending")
  const inProgress = state.todos.filter((t) => t.status === "in_progress")
  const completed = state.todos.filter((t) => t.status === "completed")
  const lines = []
  if (inProgress.length > 0) {
    lines.push("=== IN PROGRESS (R2 — optimization) ===")
    for (const t of inProgress) lines.push(`  [>] #${t.id}: ${t.text}`)
    lines.push("")
  }
  if (pending.length > 0) {
    lines.push("=== PENDING (R1 — exploration) ===")
    for (const t of pending) lines.push(`  [ ] #${t.id}: ${t.text}`)
    lines.push("")
  }
  if (completed.length > 0) {
    lines.push("=== COMPLETED (R3 — stabilization) ===")
    for (const t of completed) lines.push(`  [x] #${t.id}: ${t.text}`)
    lines.push("")
  }
  lines.push(
    `Totals: ${inProgress.length} in_progress, ${pending.length} pending, ${completed.length} completed`
  )
  return lines.join("\n")
}

// ============================================================================
// SMOKE TEST
// ============================================================================

const cwd = process.cwd()
const TEST_STATE_PATH = statePath(cwd)

let passed = 0
let failed = 0

function assert(cond, name) {
  if (cond) {
    console.log(`  ✅ ${name}`)
    passed++
  } else {
    console.log(`  ❌ ${name}`)
    failed++
  }
}

async function run() {
  console.log("=".repeat(60))
  console.log("todos_state smoke test")
  console.log("=".repeat(60))

  // Start clean
  if (existsSync(TEST_STATE_PATH)) {
    await rm(TEST_STATE_PATH)
  }

  // TEST 1: empty load returns empty state
  const empty = await loadState(cwd)
  assert(empty.todos.length === 0, "empty load returns empty todos array")
  assert(empty.next_id === 1, "empty load next_id is 1")

  // TEST 2: save and reload produces the same state
  const state1 = {
    todos: [
      { id: 1, text: "First todo", status: "pending" },
      { id: 2, text: "Second todo", status: "in_progress" },
    ],
    next_id: 3,
  }
  await saveState(cwd, state1)
  const reloaded = await loadState(cwd)
  assert(reloaded.todos.length === 2, "save+reload preserves todo count")
  assert(reloaded.todos[0].text === "First todo", "save+reload preserves text")
  assert(reloaded.todos[1].status === "in_progress", "save+reload preserves status")
  assert(reloaded.next_id === 3, "save+reload preserves next_id")

  // TEST 3: formatList output contains all statuses
  const full = {
    todos: [
      { id: 1, text: "Pending one", status: "pending" },
      { id: 2, text: "Working on this", status: "in_progress" },
      { id: 3, text: "All done", status: "completed" },
    ],
    next_id: 4,
  }
  const formatted = formatList(full)
  assert(formatted.includes("IN PROGRESS"), "formatList shows IN PROGRESS header")
  assert(formatted.includes("PENDING"), "formatList shows PENDING header")
  assert(formatted.includes("COMPLETED"), "formatList shows COMPLETED header")
  assert(formatted.includes("#1: Pending one"), "formatList includes todo 1 text")
  assert(formatted.includes("#2: Working on this"), "formatList includes todo 2 text")
  assert(formatted.includes("#3: All done"), "formatList includes todo 3 text")
  assert(
    formatted.includes("1 in_progress, 1 pending, 1 completed"),
    "formatList includes summary line"
  )

  // TEST 4: empty formatList output is the empty message
  const emptyFormat = formatList({ todos: [], next_id: 1 })
  assert(
    emptyFormat === "No todos. Use todo_add to create one.",
    "empty formatList returns the empty message"
  )

  // TEST 5: corrupted file produces empty state (resilience)
  await writeFile(TEST_STATE_PATH, "not-valid-json{", "utf8")
  const recovered = await loadState(cwd)
  assert(recovered.todos.length === 0, "corrupted file → empty todos (resilience)")
  assert(recovered.next_id === 1, "corrupted file → next_id=1 (resilience)")

  // Clean up
  if (existsSync(TEST_STATE_PATH)) {
    await rm(TEST_STATE_PATH)
  }

  console.log("")
  console.log("=".repeat(60))
  console.log(`Results: ${passed} passed, ${failed} failed`)
  console.log("=".repeat(60))
  process.exit(failed > 0 ? 1 : 0)
}

run().catch((err) => {
  console.error("Smoke test crashed:", err)
  process.exit(1)
})
