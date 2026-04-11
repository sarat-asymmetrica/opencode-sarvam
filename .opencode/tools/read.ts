// Custom read tool — replaces opencode's built-in `read` with a version that
// (1) uses the same `filePath` parameter name as opencode's built-in read,
//     for consistency with the custom write tool in this directory, and
// (2) defensively normalizes leading-slash paths the same way the write tool
//     does, so mid-sized models that emit "/sanity/hello.txt" out of Unix
//     habit don't fail with "external directory" errors.
//
// Rationale: see .opencode/tools/write.ts for the full story. This tool
// mirrors write's path-handling policy so that every file operation in this
// workspace behaves identically: strip leading slashes, resolve against cwd,
// verify inside the allowed area, proceed.

import { tool } from "@opencode-ai/plugin"
import { readFile } from "node:fs/promises"
import { isAbsolute, resolve, relative } from "node:path"

export default tool({
  description: `Read the full contents of a file as a UTF-8 string.

PATH RULES — identical to the write tool in this workspace.

The filePath parameter MUST be one of:

  (A) A path RELATIVE to the current working directory, with NO leading slash or backslash. This is the preferred form.
      Correct examples:
        "dr-classify/go.mod"
        "dr-classify/main.go"
        "sanity/hello.txt"
        "ping.txt"

  (B) A FULL absolute Windows path with a drive letter and forward slashes:
      Correct examples:
        "C:/Projects/opencode-sarvam/dr-classify/go.mod"

DO NOT use a leading slash to mean "project root". On Windows, "/dr-classify/go.mod" resolves to "C:\\\\dr-classify\\\\go.mod" — the root of the C drive — which is OUTSIDE the allowed working directory.

  WRONG examples:
    "/dr-classify/go.mod"     — leading / = drive root on Windows, REJECTED
    "\\\\dr-classify\\\\go.mod"   — same problem
    "~/dr-classify/go.mod"    — tilde is not expanded

This tool will defensively strip a leading slash if you include one (so the read will still succeed), but emitting the correct form the first time is faster and cheaper.

The parameter is named "filePath" (camelCase, capital P), matching the convention of opencode's other file tools in this workspace. Do not send "file_path" (snake_case) — the schema rejects unknown parameter names.

BEFORE reading a file you haven't written in this session, use Glob first to verify it exists. Do not speculate at file names like "main.go", "README.md", or "index.ts" without first listing the directory with Glob("<dir>/**"). Speculative reads produce ENOENT errors that waste a turn. One Glob call is cheaper than three failed Reads.`,
  args: {
    filePath: tool.schema.string().describe(
      'Path to the file to read. MUST be either (preferred) a relative path with NO leading slash like "sanity/hello.txt", or a full absolute Windows path with forward slashes like "C:/Projects/opencode-sarvam/sanity/hello.txt". NEVER use a leading slash to mean "project root" — on Windows it resolves to the drive root and the path ends up outside the working directory. Parameter name is filePath (camelCase), not file_path (snake_case).'
    ),
  },
  async execute(args, context) {
    let p = (args.filePath ?? "").trim()

    if (p.length === 0) {
      throw new Error("filePath must not be empty")
    }

    // Defensive normalization: strip leading slashes (both / and \).
    // Mirrors the behavior of the custom write tool in this workspace.
    const originalPath = p
    while (p.startsWith("/") || p.startsWith("\\")) {
      p = p.slice(1)
    }

    // Resolve relative paths against the session's working directory.
    const cwd = context.directory
    const abs = isAbsolute(p) ? p : resolve(cwd, p)

    // Security: ensure the resolved absolute path is inside cwd.
    const rel = relative(cwd, abs)
    if (rel.startsWith("..") || isAbsolute(rel)) {
      throw new Error(
        `Path "${args.filePath}" resolves to "${abs}", which is outside the working directory "${cwd}". ` +
          `Use a path relative to the working directory (e.g. "sanity/hello.txt") or a full absolute path inside this directory.`
      )
    }

    // Read and return the file contents as a UTF-8 string.
    // Errors are rewritten to be instructive rather than diagnostic — mid-sized
    // models cannot self-correct from raw ENOENT/EACCES messages, so we name the
    // likely cause and suggest the next action explicitly.
    let content: string
    try {
      content = await readFile(abs, "utf8")
    } catch (err: unknown) {
      // err.code is present on Node fs errors but not in the Error type.
      // Use a defensive accessor that works whether @types/node is set up or not.
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: unknown }).code)
          : ""
      const msg = err instanceof Error ? err.message : String(err)

      if (code === "ENOENT") {
        // Compute the parent directory (relative to cwd) for the glob suggestion.
        const parent = rel.includes("/") || rel.includes("\\")
          ? rel.replace(/[/\\][^/\\]*$/, "")
          : "."
        throw new Error(
          `File not found: "${rel}". Before reading a file you haven't written in this session, ` +
            `use Glob with pattern "${parent}/**" (or "**/*" from workspace root) to list what actually exists in that directory, ` +
            `then read specific files you see in the result. Speculative reads waste turns — one Glob call is cheaper than three failed Reads.`
        )
      }

      if (code === "EISDIR") {
        throw new Error(
          `"${rel}" is a directory, not a file. Use Glob with pattern "${rel}/**" to list its contents, ` +
            `or pass a specific file path.`
        )
      }

      if (code === "EACCES" || code === "EPERM") {
        throw new Error(
          `Permission denied reading "${rel}" (${code}). The file exists but this process cannot read it. ` +
            `Check the file's permissions with Glob or skip to a different file.`
        )
      }

      throw new Error(`Could not read "${rel}": ${msg}`)
    }

    const notice =
      originalPath !== p
        ? `\n\n[note: path was normalized from "${originalPath}" — leading slash stripped]`
        : ""

    return content + notice
  },
})
