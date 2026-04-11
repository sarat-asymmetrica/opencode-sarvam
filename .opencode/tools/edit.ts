// Custom edit tool — replaces opencode's built-in `edit` with a version that
// (1) uses the same `filePath` parameter name as our custom write and read,
// (2) defensively normalizes leading-slash paths, and
// (3) performs exact-string replacement with uniqueness enforcement.
//
// This is a SIMPLER edit than opencode's built-in (no 9-strategy fuzzy
// replacer) — it requires the model to provide an oldString that is an
// exact substring of the file and unique within it. For a multi-turn
// coding experiment with careful context-reading, this is sufficient and
// arguably more disciplined: it forces the model to read before editing,
// which matches the CodeMathEngine "trust the code, not the summary" rule.
//
// Parameter names are camelCase to match the rest of the workspace.

import { tool } from "@opencode-ai/plugin"
import { readFile, writeFile } from "node:fs/promises"
import { isAbsolute, resolve, relative } from "node:path"

export default tool({
  description: `Edit an existing file by exact string replacement. Read the file first (with the read tool) to get the exact oldString before calling edit.

PATH RULES — identical to the write and read tools in this workspace.

The filePath parameter MUST be one of:
  (A) A path RELATIVE to the current working directory, with NO leading slash:
      "dr-classify/digital_root.go"
  (B) A FULL absolute Windows path with forward slashes:
      "C:/Projects/opencode-sarvam/dr-classify/digital_root.go"

Leading slash resolves to the drive root on Windows and is rejected by the built-in tools. This custom edit tool will defensively strip a leading slash and continue, but emit the correct form the first time.

REPLACEMENT SEMANTICS:

- oldString must be an EXACT substring of the file's current content, including whitespace and newlines. No fuzzy matching — what you send is what gets matched.
- oldString must be UNIQUE in the file. If it appears more than once, the edit is rejected with an error naming both occurrences. Include more surrounding context (more lines before and after) to make the match unique.
- If oldString is not found, the edit is rejected with an error. The most common cause is whitespace mismatch — re-read the file and copy the exact bytes.
- newString replaces oldString. Whitespace and newlines in newString are preserved exactly.
- Use read BEFORE edit on any file you haven't just written in this session — do not guess what the file contains.

PARAMETER NAMES are camelCase: filePath, oldString, newString. Do not send snake_case variants like file_path or old_string — those are rejected by Zod.

For large changes (rewriting whole functions, replacing entire files), prefer calling write with the new full content instead of edit — it is often faster and avoids uniqueness-matching issues.`,
  args: {
    filePath: tool.schema.string().describe(
      'Path to the file to edit. MUST be relative with NO leading slash (e.g. "dr-classify/digital_root.go") or a full absolute Windows path. Parameter is filePath (camelCase).'
    ),
    oldString: tool.schema.string().describe(
      "The exact substring to replace. Must be present in the file exactly once. Copy it verbatim from a prior read — do not paraphrase or normalize whitespace."
    ),
    newString: tool.schema.string().describe(
      "The replacement string. May be empty (to delete the matched section) or longer/shorter than oldString. Whitespace is preserved exactly."
    ),
  },
  async execute(args, context) {
    // --- Path normalization (mirrors write and read tools) ---
    let p = (args.filePath ?? "").trim()
    if (p.length === 0) {
      throw new Error("filePath must not be empty")
    }
    const originalPath = p
    while (p.startsWith("/") || p.startsWith("\\")) {
      p = p.slice(1)
    }
    const cwd = context.directory
    const abs = isAbsolute(p) ? p : resolve(cwd, p)
    const rel = relative(cwd, abs)
    if (rel.startsWith("..") || isAbsolute(rel)) {
      throw new Error(
        `Path "${args.filePath}" resolves to "${abs}", which is outside the working directory "${cwd}". ` +
          `Use a path relative to the working directory or a full absolute path inside this directory.`
      )
    }

    // --- Read the file ---
    let original: string
    try {
      original = await readFile(abs, "utf8")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(
        `Could not read "${rel}" for editing: ${msg}. ` +
          `If the file does not exist, use the write tool instead of edit.`
      )
    }

    const oldString = args.oldString ?? ""
    const newString = args.newString ?? ""

    if (oldString.length === 0) {
      throw new Error(
        "oldString must not be empty. To create a file use the write tool; to prepend content include a non-empty substring that is already in the file."
      )
    }

    // --- Uniqueness check ---
    const firstIdx = original.indexOf(oldString)
    if (firstIdx === -1) {
      // Give the model a strong hint about the most common cause.
      const snippet = oldString.length > 80 ? oldString.slice(0, 77) + "..." : oldString
      throw new Error(
        `oldString was not found in "${rel}". The most common cause is a whitespace or newline mismatch — re-read the file with the read tool and copy the exact bytes. ` +
          `Searched for: ${JSON.stringify(snippet)}`
      )
    }
    const secondIdx = original.indexOf(oldString, firstIdx + oldString.length)
    if (secondIdx !== -1) {
      throw new Error(
        `oldString is not unique in "${rel}" — found at byte offsets ${firstIdx} and ${secondIdx}. ` +
          `Include more surrounding context (more lines before or after the change) to make the match unique.`
      )
    }

    // --- Apply the edit ---
    const updated =
      original.slice(0, firstIdx) + newString + original.slice(firstIdx + oldString.length)
    await writeFile(abs, updated, "utf8")

    const bytesBefore = Buffer.byteLength(original, "utf8")
    const bytesAfter = Buffer.byteLength(updated, "utf8")
    const delta = bytesAfter - bytesBefore
    const deltaStr = delta >= 0 ? `+${delta}` : `${delta}`
    const notice =
      originalPath !== p
        ? ` (normalized from "${originalPath}" — leading slash stripped)`
        : ""
    return `Edited ${rel}: 1 replacement applied, ${bytesAfter} bytes (${deltaStr})${notice}`
  },
})
