# Agent Harness Best Practices — Running Mid-Sized OpenAI-Compatible Models in OpenCode on Windows

A debrief from roughly two hours of debugging Sarvam 105B driving OpenCode against a small Go CLI exercise on Windows. Six bugs surfaced, all mechanical, all preventable. This document captures the failure modes and the defenses so the next setup does not repeat them.

Audience: a human engineer or AI agent wiring Sarvam — or any mid-sized OpenAI-compatible model — into OpenCode on Windows for the first time. Cross-references point to `CLAUDE.md`, `opencode.json`, and the custom tools under `.opencode/tools/` in this workspace.

---

## 1. Paths: leading slashes silently escape the workspace

**Symptom.** Sarvam emits `"/dr-classify/go.mod"` out of Unix reflex. OpenCode rejects with *"you are trying to access an external directory"*. The model retries the same path. Session burns turns, never recovers.

**Cause.** On Windows, Node's `path.resolve("/foo")` returns `C:\foo` — the drive root — not `cwd/foo`. OpenCode's built-in write tool then correctly flags the path as outside cwd. The error is accurate but not instructive: it does not tell the model that the leading slash is the problem, so the model assumes "permissions" and retries identically.

**Fix — defense in depth.** Ship custom tools at `.opencode/tools/write.ts`, `.opencode/tools/read.ts`, and `.opencode/tools/edit.ts` that (a) carry hyper-explicit schema descriptions with correct AND wrong examples, and (b) defensively strip leading slashes in the execute function before resolving:

```ts
let p = (args.filePath ?? "").trim()
const originalPath = p
while (p.startsWith("/") || p.startsWith("\\")) {
  p = p.slice(1)
}
const abs = isAbsolute(p) ? p : resolve(context.directory, p)
```

The schema teaches, the execute recovers. When recovery fires, the return value includes a `(normalized from "/..." — leading slash stripped)` notice so the model can notice its own habit. The path convention is also documented in the "File path conventions" section of `CLAUDE.md`.

---

## 2. Shell: `bash` on Windows is actually PowerShell

**Symptom.** Model emits `mkdir -p dr-classify`, `ls -la`, `cat main.go`, `grep -r foo .`. Commands fail with *"At line:1 char:1"* and *"CategoryInfo"* errors. File operations never happen.

**Cause.** OpenCode's `bash` tool spawns the host shell. On Windows that is PowerShell, which does not recognize Unix flags like `-p` / `-la` / `-r` and has different builtins. Sarvam was trained predominantly on Unix shell and reaches for it by default.

**Fix.** Narrow the use of `bash` to what actually needs a shell — compilers, test runners, built binaries — and route every file-system operation through dedicated tools. `CLAUDE.md` (section "Shell and tool selection") enumerates the substitution table: `Write` replaces `mkdir` + `touch`, `Glob` replaces `ls`, `Read` replaces `cat`, `Grep` replaces `grep -r`. A wrapper at `.opencode/tools/bash.ts` is being built in parallel to translate `cd X && Y` forms and guard against empty stdout; until it lands, treat `bash` as a narrow escape hatch, not a primary interface.

---

## 3. Empty stdout crashes the tool-result schema

**Symptom.** A successful `go build ./...` returns zero bytes of stdout. OpenCode crashes with `body.messages.N.tool.content : String should have at least 1 character`. The entire session dies mid-turn.

**Cause.** OpenCode's tool-result pipeline validates `content` with Zod's `z.string().min(1)`. Silent success from a shell command produces an empty string, the schema rejects the assistant message before it is sent, and the session errors out. This is the framework's bug, but you inherit it.

**Fix.** Any shell command that might succeed silently MUST append a sentinel. The canonical form:

```bash
go test ./... ; echo DONE
go build ./... ; echo DONE
```

One line in `CLAUDE.md` covers this ("If you must use `bash` and the command might return empty output, append a sentinel so stdout is never empty"). The planned `bash.ts` wrapper will auto-append a sentinel so the rule is enforced by the harness rather than by the model's memory.

---

## 4. Parameter casing: `filePath` vs `file_path`

**Symptom.** A custom tool declares `file_path` while an OpenCode built-in uses `filePath`. The model pattern-matches off the most recent successful call, emits the wrong casing, and Zod rejects with `expected string, received undefined at path ['filePath']`. The model cannot self-correct because the error does not name the expected parameter.

**Cause.** Mid-sized models cross-tool confuse under naming inconsistency. Zod's default validation error is diagnostic (it reports the failing path in the schema) but not instructive (it does not say "you should have sent `filePath` instead of `file_path`"). Retries draw the wrong name from the same training prior and loop.

**Fix.** Match the framework's convention everywhere. OpenCode's built-in `edit`, `read`, `glob`, and `grep` all use camelCase; every custom tool in this workspace — `.opencode/tools/write.ts`, `read.ts`, `edit.ts` — uses `filePath`, `oldString`, `newString` to match. The convention is called out explicitly in both the tool description block and the parameter-level `.describe()` string, and again in `CLAUDE.md`'s "Parameter naming convention" note. Never mix casings within a workspace.

---

## 5. Error messages must be instructive, not diagnostic

**Symptom.** A validation failure surfaces Zod's raw message: `expected string, received undefined`. The model treats this as a transient error and retries with the same payload.

**Cause.** Diagnostic errors describe what went wrong in terms of the schema author's mental model. Instructive errors describe what the caller must do differently, in the caller's vocabulary. Mid-sized models only reliably recover from the latter.

**Fix.** Catch validation and runtime failures in custom tool wrappers and rewrite them. A good instructive error has three parts: (1) name the expected shape, (2) show what was received, (3) give a concrete retry instruction. The edit tool models this well — when `oldString` is not found it tells the model *"The most common cause is a whitespace or newline mismatch — re-read the file with the read tool and copy the exact bytes"*, and when the match is ambiguous it reports both byte offsets and says to add surrounding context. Generalize this habit to every wrapper you own.

---

## 6. The custom-tool defense-in-depth pattern

Pulling the previous sections together, every custom file tool in `.opencode/tools/` follows the same belt-and-braces structure:

1. **Top-level `description`** — a multi-paragraph block with `PATH RULES`, correct examples, wrong examples, and a note on parameter casing. This is what the model sees when it decides how to call the tool. Redundancy is a feature, not a bug.
2. **Parameter-level `.describe()`** — repeats the critical rule in the single sentence the model is most likely to actually read. Treat it as the last line of defense before execution.
3. **Defensive execute function** — normalizes bad input silently (strip leading slashes, trim whitespace) rather than rejecting. Emits a notice in the return value when normalization fires so the model can learn. Hard-rejects only genuinely unsafe inputs (paths that escape cwd after normalization).

The schema teaches on the way in, the execute recovers when teaching fails, and the error messages teach again when recovery is not possible.

---

## Copy-paste checklist — new Sarvam-on-OpenCode-on-Windows workspace

1. Set `SARVAM_API_KEY` in the environment or a gitignored `.env`; confirm the header is `api-subscription-key`, NOT `Authorization: Bearer`.
2. In `opencode.json`, register the provider via `@ai-sdk/openai-compatible` with `baseURL: https://api.sarvam.ai/v1` and inject the key via `options.headers`. See this workspace's `opencode.json` for the working shape.
3. Copy `.opencode/tools/write.ts`, `.opencode/tools/read.ts`, and `.opencode/tools/edit.ts` verbatim. They override the built-ins and encode the path-normalization and error-rewriting lessons.
4. Use camelCase parameter names everywhere: `filePath`, `oldString`, `newString`. Never introduce a snake_case parameter in a workspace that also uses a built-in tool.
5. In `CLAUDE.md`, include the "File path conventions" section (no leading slash on Windows) AND the "Shell and tool selection" section (bash is PowerShell, prefer dedicated tools).
6. For every shell command that might succeed silently, append `; echo DONE`. Apply this to `go build`, `go test`, `go vet`, `go fmt -l .`, and any linter.
7. Write custom tool error messages as instructions, not diagnostics: name the expected shape, show what arrived, give one concrete retry step.
8. In the custom tool description blocks, include both CORRECT and WRONG examples. Mid-sized models learn better from contrast than from prose.
9. Test the harness with a deliberate leading-slash path and a deliberate empty-output shell command before running any real exercise. Both should recover cleanly.
10. When the model retries identically after an error, treat that as a harness bug, not a model bug — the error message failed to teach. Fix the wrapper, not the prompt.
11. Do not mix Unix and Windows path conventions in examples, documentation, or prompts. Pick one canonical form per workspace and enforce it.
12. If a new bug surfaces that looks mechanical and repeatable, add it to this document before moving on. The cost of writing it down is a few minutes; the cost of rediscovering it is another afternoon.
