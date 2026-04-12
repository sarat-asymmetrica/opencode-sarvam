// Shared state management for the memory tool family (memory_write + memory_recall).
//
// MVP implementation: a JSON array of {id, fact, timestamp} objects stored at
// .opencode/state/memory.json. Retrieval is simple substring matching.
//
// This is deliberately minimal. The upgrade path to Memori's full
// Subject-Predicate-Object engine is: replace this module's internals with
// Memori SQLAlchemy calls. The tool interface stays the same.
//
// Why not Memori directly? Memori's TypeScript SDK is cloud-only. Memori's
// Python SDK supports local SQLite but would require a subprocess bridge.
// For the MVP "does Clause 19 priority 1 work?" test, file-based memory
// with substring recall is sufficient and ships in 15 minutes.

import { readFile, writeFile, mkdir } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { existsSync } from "node:fs"

export interface MemoryEntry {
  id: number
  fact: string
  timestamp: string // ISO 8601
}

export interface MemoryState {
  entries: MemoryEntry[]
  next_id: number
}

const STATE_FILE = ".opencode/state/memory.json"

export function memoryPath(cwd: string): string {
  return resolve(cwd, STATE_FILE)
}

export async function loadMemory(cwd: string): Promise<MemoryState> {
  const path = memoryPath(cwd)
  if (!existsSync(path)) {
    return { entries: [], next_id: 1 }
  }
  try {
    const raw = await readFile(path, "utf8")
    const parsed = JSON.parse(raw)
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      Array.isArray(parsed.entries) &&
      typeof parsed.next_id === "number"
    ) {
      return parsed as MemoryState
    }
    return { entries: [], next_id: 1 }
  } catch {
    return { entries: [], next_id: 1 }
  }
}

export async function saveMemory(cwd: string, state: MemoryState): Promise<void> {
  const path = memoryPath(cwd)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(state, null, 2), "utf8")
}

/**
 * Simple substring-based recall. Returns entries whose fact text contains
 * any of the query's significant words (length >= 4, lowercased).
 *
 * Scoring: each entry gets +1 for each query word found in its fact text.
 * Results are sorted by score descending, top-k returned.
 *
 * This is intentionally crude — it's the MVP retrieval. The upgrade to
 * Memori's full semantic search replaces this function only.
 */
export function recall(
  state: MemoryState,
  query: string,
  topK: number = 5
): MemoryEntry[] {
  if (state.entries.length === 0) return []

  // Extract significant words from query (length >= 4 to skip stopwords)
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 4)

  if (words.length === 0) {
    // No significant words — return most recent entries
    return state.entries.slice(-topK).reverse()
  }

  // Score each entry
  const scored = state.entries.map((entry) => {
    const factLower = entry.fact.toLowerCase()
    let score = 0
    for (const word of words) {
      if (factLower.includes(word)) score++
    }
    return { entry, score }
  })

  // Filter to entries with at least one match, sort by score desc, take top-k
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s) => s.entry)
}
