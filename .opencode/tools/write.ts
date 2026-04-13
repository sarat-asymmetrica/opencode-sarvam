// Custom write tool — replaces opencode's built-in `write` with a version that
// (1) tells the model exactly how paths work in this environment, via an
//     extremely explicit schema description, and
// (2) defensively normalizes bad paths (leading slashes, backslashes) so that
//     even if a mid-sized model like Sarvam 105B emits "/dr-classify/go.mod" out
//     of Unix habit, the write still lands in the correct place inside cwd.
//
// See: C:/Projects/opencode-sarvam/CLAUDE.md "File path conventions" for the
// background on why this override exists. TL;DR: on Windows, Node's
// path.resolve("/foo") returns "C:\\foo" (drive root), not "cwd/foo", and the
// built-in write tool doesn't tell the model this. Sarvam and similar
// OpenAI-compatible models then fail in a retry loop that burns turns.

import { tool } from "@opencode-ai/plugin"
import { writeFile, mkdir } from "node:fs/promises"
import { dirname, isAbsolute, resolve, relative } from "node:path"

export default tool({
  description: `Create a new file or overwrite an existing file with the given content. Parent directories are created automatically — do NOT call mkdir separately.

PATH RULES — READ CAREFULLY. Mid-sized OpenAI-compatible models frequently get these wrong by Unix reflex. Getting them right on the first call saves turns.

The filePath parameter MUST be one of:

  (A) A path RELATIVE to the current working directory, with NO leading slash or backslash. This is the preferred form.
      Correct examples:
        "dr-classify/go.mod"
        "dr-classify/main.go"
        "exercises/001-dr-classify.md"
        "README.md"

  (B) A FULL absolute Windows path with a drive letter and forward slashes:
      Correct examples:
        "C:/Projects/opencode-sarvam/dr-classify/go.mod"
        "C:/Projects/opencode-sarvam/main.go"

DO NOT use a leading slash to mean "project root". On Windows, a path like "/dr-classify/go.mod" resolves to "C:\\\\dr-classify\\\\go.mod" — the root of the C drive — which is OUTSIDE the allowed working directory. This environment is Windows, not Unix.

  WRONG examples (do not use these forms):
    "/dr-classify/go.mod"     — leading / = drive root on Windows
    "\\\\dr-classify\\\\go.mod"   — leading \\\\ = same problem
    "~/dr-classify/go.mod"    — tilde is not expanded
    "./dr-classify/go.mod"    — leading ./ is allowed but unnecessary; drop it

This tool will defensively strip a leading slash if you include one (so your write will still succeed), but emitting the correct form the first time is faster and cheaper.`,
  args: {
    filePath: tool.schema.string().describe(
      'Path to the file to write. MUST be either (preferred) a relative path with NO leading slash like "dr-classify/go.mod", or a full absolute Windows path with forward slashes like "C:/Projects/opencode-sarvam/dr-classify/go.mod". NEVER use a leading slash to mean "project root" — on Windows it resolves to the drive root and the path ends up outside the working directory. Parent directories are created automatically; do not call mkdir separately.'
    ),
    content: tool.schema.string().describe(
      "The complete content to write to the file as a UTF-8 string. For a new file this is the entire file. For an overwrite it replaces previous content entirely."
    ),
  },
  async execute(args, context) {
    let p = (args.filePath ?? "").trim()

    if (p.length === 0) {
      throw new Error("filePath must not be empty")
    }

    // Architectural defense: block ELEGANCE_CHECK file creation.
    // Sarvam 105B pattern-matches on "### ELEGANCE_CHECK" and tries to
    // write it as a .md file, despite 10+ lines of prompt prohibition.
    // This cannot be fixed at the prompt level (Day 1 Run 04, Day 2 Run 06).
    // The fix is here: reject the write with a pedagogical message.
    if (p.toLowerCase().includes("elegance_check") || p.toLowerCase().includes("elegance-check")) {
      throw new Error(
        "BLOCKED: Do not write ELEGANCE_CHECK as a file. " +
        "The ELEGANCE_CHECK section belongs in your TEXT RESPONSE to the user, " +
        "not on disk. Write it as a ### heading in your message, not as a file. " +
        "This write has been rejected — no file was created."
      )
    }

    // Defensive normalization: strip leading slashes (both / and \).
    // This is the key fix for the leading-slash habit. We do NOT reject —
    // we recover silently and log what happened, so the model doesn't spin
    // in a rejection/retry loop. CLAUDE.md + the schema description above
    // teach the model the right form; this just catches the habit until
    // the lesson sticks.
    const originalPath = p
    while (p.startsWith("/") || p.startsWith("\\")) {
      p = p.slice(1)
    }

    // Resolve relative paths against the session's working directory.
    // Absolute paths (with drive letter like "C:/...") are kept as-is.
    const cwd = context.directory
    const abs = isAbsolute(p) ? p : resolve(cwd, p)

    // Security: ensure the resolved absolute path is inside cwd.
    // If `rel` starts with ".." or is itself absolute (different drive),
    // the write would escape the workspace — reject explicitly.
    const rel = relative(cwd, abs)
    if (rel.startsWith("..") || isAbsolute(rel)) {
      throw new Error(
        `Path "${args.filePath}" resolves to "${abs}", which is outside the working directory "${cwd}". ` +
          `Use a path relative to the working directory (e.g. "dr-classify/go.mod") or a full absolute path inside this directory.`
      )
    }

    // Create parent directories as needed.
    await mkdir(dirname(abs), { recursive: true })

    // Defensive: detect and reverse HTML entity encoding in non-HTML files.
    // Some API providers (AIMLAPI) HTML-encode tool call content, turning
    // `"bytes"` into `&quot;bytes&quot;`. This corrupts Go, Python, etc. source files.
    // Only apply to non-HTML files (HTML files legitimately contain entities).
    let content = args.content
    const ext = rel.split(".").pop()?.toLowerCase() ?? ""
    const isHtmlFile = ["html", "htm", "xml", "svg"].includes(ext)

    if (!isHtmlFile && content.includes("&quot;")) {
      // Content was likely HTML-encoded by the API provider. Reverse it.
      content = content
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")  // &amp; MUST be last (it's a prefix of the others)

      // Log recovery for observability
      var entityNotice = " (HTML entities detected and reversed — API provider encoding issue)"
    }

    await writeFile(abs, content, "utf8")

    const bytes = Buffer.byteLength(content, "utf8")
    const pathNotice =
      originalPath !== p
        ? ` (normalized from "${originalPath}" — leading slash stripped)`
        : ""
    return `Wrote ${rel} (${bytes} bytes)${pathNotice}${entityNotice ?? ""}`
  },
})
