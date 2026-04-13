// Custom edit tool — replaces opencode's built-in `edit` with a version that
// (1) uses the same `filePath` parameter name as our custom write and read,
// (2) defensively normalizes leading-slash paths, and
// (3) performs exact-string replacement with uniqueness enforcement,
// (4) falls back to FUZZY WHITESPACE MATCHING when exact match fails.
//
// v2.5 addition: the fuzzy fallback. Run 07 showed Sarvam 105B burning 6+
// tool calls on Bug 1 because multi-line oldStrings had subtly wrong
// whitespace (tabs vs spaces, trailing whitespace, \r\n vs \n). The fuzzy
// strategy: normalize both oldString and file content by (a) replacing \r\n
// with \n, (b) stripping trailing whitespace per line, (c) collapsing runs
// of spaces/tabs within each line to single space. If exactly one match in
// the normalized file, map back to original positions and apply the edit.
//
// newString is NEVER normalized — it's inserted exactly as provided.

import { tool } from "@opencode-ai/plugin"
import { readFile, writeFile } from "node:fs/promises"
import { isAbsolute, resolve, relative } from "node:path"

/**
 * Normalize a string for fuzzy whitespace comparison:
 * - \r\n → \n
 * - strip trailing whitespace per line
 * - collapse interior runs of spaces/tabs to single space
 * - trim leading whitespace? NO — indentation matters for position mapping
 */
function normalizeWS(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd().replace(/[ \t]+/g, " "))
    .join("\n")
}

/**
 * Find the start/end byte positions in `original` that correspond to
 * a fuzzy match found at position `normIdx` of length `normLen` in
 * the normalized version.
 *
 * Strategy: we normalize line-by-line, so we can build a mapping from
 * normalized-character-offset to original-character-offset by walking
 * both versions in parallel.
 */
function mapNormToOriginal(
  original: string,
  normIdx: number,
  normLen: number
): { start: number; end: number } | null {
  const normFull = normalizeWS(original)
  // Find which original chars map to the matched normalized region.
  // Because normalizeWS operates line-by-line and only collapses/trims
  // within each line, we can build a character map.

  const origLines = original.replace(/\r\n/g, "\n").split("\n")
  const normLines = normFull.split("\n")

  // Build a flat array: normCharIdx → origCharIdx
  // We walk through lines in parallel.
  const map: number[] = []
  let origOffset = 0

  for (let li = 0; li < origLines.length; li++) {
    const oLine = origLines[li]
    const nLine = normLines[li]

    // Walk through normalized line and map each char back to original
    let oi = 0 // position in original line
    for (let ni = 0; ni < nLine.length; ni++) {
      // If normalized char is a space that resulted from collapsing,
      // advance oi past the run of whitespace in original
      if (nLine[ni] === " " && ni > 0) {
        // Check if we're in a collapsed whitespace region
        if (oLine[oi] === " " || oLine[oi] === "\t") {
          map.push(origOffset + oi)
          // Skip past the whitespace run in original
          while (oi < oLine.length - 1 && (oLine[oi + 1] === " " || oLine[oi + 1] === "\t")) {
            oi++
          }
          oi++
          continue
        }
      }
      map.push(origOffset + oi)
      oi++
    }
    // Account for the newline between lines (except last)
    if (li < origLines.length - 1) {
      map.push(origOffset + oLine.length) // the \n position
      origOffset += oLine.length + 1 // +1 for \n
    } else {
      origOffset += oLine.length
    }
  }

  if (normIdx >= map.length) return null
  const endNormIdx = normIdx + normLen - 1
  if (endNormIdx >= map.length) return null

  const start = map[normIdx]
  // For the end, we need the position AFTER the last matched character
  // Find the next original position after the last matched normalized char
  const lastOrigChar = map[endNormIdx]

  // Walk forward in original from lastOrigChar to include any trailing
  // whitespace that was stripped by normalization
  const crlfOriginal = original.replace(/\r\n/g, "\n")
  let end = lastOrigChar + 1

  // If the match ends at a line boundary, include trailing whitespace
  // that was stripped by trimEnd()
  if (endNormIdx + 1 < map.length) {
    // Not at the very end — end is just past the last matched char
    // But we need to include any trailing whitespace that was stripped
    const nextMapped = map[endNormIdx + 1]
    // If there's a gap, it's stripped whitespace — DON'T include it
    // (the original's whitespace between the match end and next content
    // should be preserved, not consumed by our match)
    end = lastOrigChar + 1
  } else {
    // At the very end of the file
    end = crlfOriginal.length
  }

  return { start, end }
}

export default tool({
  description: `Edit an existing file by string replacement. Read the file first (with the read tool) to get the oldString before calling edit.

MATCHING: This tool first tries EXACT substring matching. If that fails, it falls back to FUZZY WHITESPACE MATCHING — normalizing tabs/spaces/trailing whitespace/line endings before comparing. This means minor whitespace mismatches won't cause failures, but you should still try to be accurate.

PATH RULES — identical to the write and read tools in this workspace.

The filePath parameter MUST be one of:
  (A) A path RELATIVE to the current working directory, with NO leading slash:
      "dr-classify/digital_root.go"
  (B) A FULL absolute Windows path with forward slashes:
      "C:/Projects/opencode-sarvam/dr-classify/digital_root.go"

REPLACEMENT SEMANTICS:

- oldString should match a section of the file. Exact match is preferred; fuzzy whitespace matching is used as fallback.
- oldString must be UNIQUE in the file (whether matched exactly or fuzzily). Include more surrounding context to make it unique.
- newString replaces oldString EXACTLY as provided (no normalization on newString).
- Use read BEFORE edit on any file you haven't just written in this session.

TIP: Use SMALL oldStrings — ideally just the 1-3 lines you're changing plus 1 line of unique context above. Multi-line oldStrings fail more often.

PARAMETER NAMES are camelCase: filePath, oldString, newString.`,
  args: {
    filePath: tool.schema.string().describe(
      'Path to the file to edit. MUST be relative with NO leading slash (e.g. "dr-classify/digital_root.go") or a full absolute Windows path. Parameter is filePath (camelCase).'
    ),
    oldString: tool.schema.string().describe(
      "The text to replace. Should match a section of the file. Exact match is tried first; fuzzy whitespace matching is used as fallback if exact match fails."
    ),
    newString: tool.schema.string().describe(
      "The replacement string. Inserted exactly as provided. May be empty (to delete) or any length."
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

    // Defensive: reverse HTML entity encoding in tool call args.
    // Some API providers HTML-encode content, breaking exact matching.
    const ext = rel.split(".").pop()?.toLowerCase() ?? ""
    const isHtmlFile = ["html", "htm", "xml", "svg"].includes(ext)

    function unescapeEntities(s: string): string {
      if (isHtmlFile || !s.includes("&quot;")) return s
      return s
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
    }

    const oldString = unescapeEntities(args.oldString ?? "")
    const newString = unescapeEntities(args.newString ?? "")

    if (oldString.length === 0) {
      throw new Error(
        "oldString must not be empty. To create a file use the write tool; to prepend content include a non-empty substring that is already in the file."
      )
    }

    // --- Strategy 1: Exact match (fast path) ---
    const exactIdx = original.indexOf(oldString)
    if (exactIdx !== -1) {
      // Check uniqueness
      const secondIdx = original.indexOf(oldString, exactIdx + oldString.length)
      if (secondIdx !== -1) {
        throw new Error(
          `oldString is not unique in "${rel}" — found at byte offsets ${exactIdx} and ${secondIdx}. ` +
            `Include more surrounding context to make the match unique.`
        )
      }

      // Apply exact edit
      const updated =
        original.slice(0, exactIdx) + newString + original.slice(exactIdx + oldString.length)
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
    }

    // --- Strategy 2: Fuzzy whitespace match (fallback) ---
    const normFile = normalizeWS(original)
    const normOld = normalizeWS(oldString)

    const fuzzyIdx = normFile.indexOf(normOld)
    if (fuzzyIdx === -1) {
      const snippet = oldString.length > 80 ? oldString.slice(0, 77) + "..." : oldString
      throw new Error(
        `oldString was not found in "${rel}" (tried exact and fuzzy whitespace matching). ` +
          `Re-read the file and use a SMALLER oldString — ideally just the 1-3 lines being changed. ` +
          `Searched for: ${JSON.stringify(snippet)}`
      )
    }

    // Check fuzzy uniqueness
    const fuzzySecond = normFile.indexOf(normOld, fuzzyIdx + normOld.length)
    if (fuzzySecond !== -1) {
      throw new Error(
        `oldString matches multiple locations in "${rel}" (via fuzzy whitespace matching). ` +
          `Include more surrounding context to make the match unique.`
      )
    }

    // Map fuzzy match back to original positions
    // Simpler approach: split both into lines, find the matching line range
    const normFileLines = normFile.split("\n")
    const normOldLines = normOld.split("\n")

    // Find which line in normFile starts the match
    let matchStartLine = -1
    for (let i = 0; i <= normFileLines.length - normOldLines.length; i++) {
      let matches = true
      for (let j = 0; j < normOldLines.length; j++) {
        if (normFileLines[i + j] !== normOldLines[j]) {
          matches = false
          break
        }
      }
      if (matches) {
        // Verify this is the ONLY match (we already checked via indexOf, but belt-and-suspenders)
        matchStartLine = i
        break
      }
    }

    if (matchStartLine === -1) {
      // Fallback: the match spans a line boundary in a way line-by-line can't catch.
      // Use character-level mapping.
      const positions = mapNormToOriginal(original, fuzzyIdx, normOld.length)
      if (!positions) {
        throw new Error(
          `Fuzzy match found but could not map back to original positions in "${rel}". ` +
            `Use a smaller oldString.`
        )
      }
      const crlfNormalized = original.replace(/\r\n/g, "\n")
      const updated =
        crlfNormalized.slice(0, positions.start) +
        newString +
        crlfNormalized.slice(positions.end)
      await writeFile(abs, updated, "utf8")

      const bytesBefore = Buffer.byteLength(original, "utf8")
      const bytesAfter = Buffer.byteLength(updated, "utf8")
      const delta = bytesAfter - bytesBefore
      const deltaStr = delta >= 0 ? `+${delta}` : `${delta}`
      return `Edited ${rel}: 1 replacement applied (fuzzy whitespace match), ${bytesAfter} bytes (${deltaStr})`
    }

    // Line-level match found. Extract original lines for that range.
    const origLines = original.replace(/\r\n/g, "\n").split("\n")
    const matchEndLine = matchStartLine + normOldLines.length - 1

    // Calculate character positions in the \n-normalized original
    const crlfNormalized = original.replace(/\r\n/g, "\n")
    let startCharPos = 0
    for (let i = 0; i < matchStartLine; i++) {
      startCharPos += origLines[i].length + 1 // +1 for \n
    }
    let endCharPos = startCharPos
    for (let i = matchStartLine; i <= matchEndLine; i++) {
      endCharPos += origLines[i].length + (i < origLines.length - 1 ? 1 : 0)
    }

    const updated =
      crlfNormalized.slice(0, startCharPos) + newString + crlfNormalized.slice(endCharPos)
    await writeFile(abs, updated, "utf8")

    const bytesBefore = Buffer.byteLength(original, "utf8")
    const bytesAfter = Buffer.byteLength(updated, "utf8")
    const delta = bytesAfter - bytesBefore
    const deltaStr = delta >= 0 ? `+${delta}` : `${delta}`
    const notice =
      originalPath !== p
        ? ` (normalized from "${originalPath}" — leading slash stripped)`
        : ""
    return `Edited ${rel}: 1 replacement applied (fuzzy whitespace match), ${bytesAfter} bytes (${deltaStr})${notice}`
  },
})
