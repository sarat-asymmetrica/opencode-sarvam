# opencode-sarvam

**Purpose:** A minimal, sterile OpenCode workspace for testing the **CodeMathEngine v2 discipline** on long-horizon multi-turn coding tasks driven by **Sarvam 105B**.

This is an experiment, not a production environment. Nothing here should be treated as shippable software. It exists to answer one research question:

> **Does the CodeMathEngine v2 prompt discipline hold when the model has to carry it across 20-80 turns with compaction pressure and tool-use interruptions?**

Single-turn performance was empirically validated on April 11, 2026 in `C:\Projects\ananta\human_testing\codemath_lab.mjs`. This workspace extends that validation to multi-turn.

---

## Provenance

- **Prior work:** `C:\Projects\ananta\human_testing\codemath_lab.mjs` (single-turn A/B lab)
- **Findings doc:** `C:\Projects\ananta\human_testing\CODEMATH_LAB_FINDINGS_2026-04-11.md`
- **Parent design note:** `C:\Projects\ananta\docs\asymmetrica_design_notes.md` (Claude web's CodeMathEngine v2 revision)
- **Pattern borrowed from:** `C:\Projects\ananta\opencode.json` (Ananta's production OpenCode config, GPT-5.4 based)

The v2 Pragmatic prompt currently loaded in `.opencode/agents/codemath-lead.md` is a **direct extension** of the prompt that scored empirically well this afternoon (gap of -0.11 on bank_account_evolve, grader overall 0.96). It adds (a) the adequacy axiom from v3, (b) multi-turn discipline for handling compaction, (c) tool-use framing.

---

## What this workspace is NOT

- **Not Ananta.** Do not import Ananta code. Do not touch Ananta files. Do not assume Ananta's skills, webhooks, intelligence layer, or kernels are available. If you need to test code, write it here, in this directory.
- **Not a persona experiment.** The agent has no name beyond CodeMathEngine. No BEACON governance. No EQ/Cognition skills. No warmth layer. Those belong to Ananta's production config. Here we test the raw discipline, unadorned.
- **Not Pocket Alchemy.** That's a different (larger, parallel) initiative in `C:\Projects\ananta\docs\POCKET_ALCHEMY_DESIGN.md`. This workspace is infrastructure for testing the *prompt* that will eventually drive Pocket Alchemy's parameterization layer, but they are separate experiments for now.

---

## What to test here

Tasks that exercise multi-turn discipline under real compaction pressure. Candidate exercises (not yet implemented — this is a seed list):

1. **Bank account v2**: implement `evolve` from scratch, then iterate: add validation, add audit log, add a second event-sourcing view. Count how many turns before the original discipline drifts.
2. **Digital root filter library**: implement a small library with 4-5 related functions (filter, classify, roll_up, group_by_dr). Watch whether minimality holds across files.
3. **Small discount rules engine**: the problem from codemath_lab.mjs scaled up to 8-10 rule types with composition. Test adequacy explicitly.
4. **Refactor an intentionally-ugly Python file** (not yet written) — give the model a 200-line file that violates every axiom, ask it to refactor. This measures whether v2 can apply its own discipline to foreign code, not just produce fresh code.
5. **Multi-file project**: "build a small CLI that reads a JSON, computes X, writes Y, with tests." Spans 3-5 files. Measures cross-file locality.

**Metric to measure on every session:**
- Does the model write an ELEGANCE_CHECK section as plain text in its final response on meaningful edits?
- Do self-scores stay in the honest range (mostly 0.7-0.9, rarely 0.95+)?
- After compaction fires, does the ritual survive or does the model forget to self-score?
- Does the model catch its own drift (e.g., "I added a side effect in turn 17 inside a function I'd declared pure in turn 4")?

---

## Setup

### 1. Environment

Set the Sarvam API key in your shell environment:

```bash
export SARVAM_API_KEY="sk_ro2wts6u_..."
```

Or put it in `.env` (gitignored) and load before running OpenCode. The key is the same one used by Ananta — see `C:\Projects\ananta\webhook\.env`.

### 2. Install OpenCode (if not already)

```bash
# Assuming opencode CLI is on PATH
opencode --version
```

If not installed, see https://opencode.ai for install instructions.

### 3. Run

```bash
cd C:/Projects/opencode-sarvam
opencode
```

OpenCode should pick up `opencode.json` automatically and load the `codemath-lead` agent.

### 4. Known risks & things to watch for

- **`reasoning_content` field handling**: Sarvam 105B separates `reasoning_content` from `content` in its response. If OpenCode's `@ai-sdk/openai-compatible` provider doesn't merge them, you may see empty responses on reasoning-heavy turns. This was the bug we hit in `codemath_lab.mjs` this afternoon — we fixed it by falling back to `reasoning_content` when `content` was empty. OpenCode may need a similar fix or a custom provider wrapper.
- **Unbounded reasoning token consumption**: Sarvam with `reasoning_effort=medium` can burn 500-1000 tokens on internal reasoning per turn. With 128K context and an 80-step agent, compaction will fire. This is expected and part of the experiment.
- **Header auth quirk**: Sarvam uses `api-subscription-key` header, not `Authorization: Bearer`. The provider config above uses `options.headers` to inject it. If the openai-compatible provider ignores custom headers, auth will fail with 401 and we'll need a wrapper.
- **Small context vs Ananta's production**: 128K is 8× smaller than GPT 5.4's 1.05M. Tasks that feel roomy in Ananta will feel tight here. Plan accordingly.

---

## File path conventions (IMPORTANT — read before calling Write/Edit/Read)

The `Write`, `Edit`, and `Read` tools in this environment run on **Windows**, where file paths are resolved by Node's `path.resolve()`. This has two consequences you must understand:

1. **Never use a leading slash.** A path like `/dr-classify/go.mod` does NOT mean "from the project root" — on Windows it resolves to `C:\dr-classify\go.mod`, which is outside the allowed working directory and will be rejected with *"you are trying to access an external directory"*.

2. **Use one of these two forms:**
   - **Relative (preferred):** `dr-classify/go.mod` — resolved against the current working directory (`C:\Projects\opencode-sarvam`)
   - **Absolute Windows:** `C:/Projects/opencode-sarvam/dr-classify/go.mod` — forward slashes work fine on Windows and avoid backslash escaping

| Wrong                     | Right                                             |
|---------------------------|---------------------------------------------------|
| `/dr-classify/go.mod`     | `dr-classify/go.mod`                              |
| `/main.go`                | `main.go`                                         |
| `/exercises/001.md`       | `exercises/001.md`                                |

**If a tool call is rejected with an "external directory" error, the fix is almost always to remove the leading slash.** Do not retry the same path — read the error, form a hypothesis, adjust, then retry. Identical retries after a rejection are a discipline failure, not a strategy.

**Defense-in-depth: this workspace ships custom `write`, `read`, and `edit` tools** at `.opencode/tools/write.ts`, `.opencode/tools/read.ts`, and `.opencode/tools/edit.ts` that replace opencode's built-ins. They have two jobs: (1) their schema descriptions tell the model, in explicit detail, how paths resolve on Windows; (2) their execute functions defensively strip leading slashes before resolving, so even if a path like `/dr-classify/go.mod` slips through, the operation still lands in the correct place. The tools' return values will include a `(normalized from "/..." — leading slash stripped)` notice when recovery fires — if you see that notice, take it as a reminder to emit the correct form on subsequent calls. The recovery exists so you don't get stuck in retry loops, not as a license to ignore the convention.

**Parameter naming convention — IMPORTANT**: every file tool in this workspace uses `filePath` (camelCase, capital P) as the path argument name. This matches opencode's built-in `edit`, `read`, `glob`, and `grep` tools, which also use camelCase throughout. **Do NOT send `file_path` (snake_case)** — Zod schemas reject unknown parameter names, and you will get an `expected string, received undefined` error that cannot be recovered from by retry. If you see that specific error, the fix is almost always to rename your argument from `file_path` to `filePath` and retry once. Do not retry identically; the convention is strict.

---

## Shell and tool selection (IMPORTANT — read before using `bash`)

The `bash` tool in this environment spawns **PowerShell on Windows**, not Unix bash. This means Unix-style commands like `mkdir -p`, `ls -la`, `cat`, `grep -r`, `find`, `rm -rf`, `touch` will fail outright or behave unexpectedly. Error output from PowerShell looks like *"At line:1 char:1"* and *"CategoryInfo : ..."* — that's the giveaway.

**Rule: use dedicated tools for file operations, reserve `bash` for compilers, tests, and binaries.**

OpenCode exposes `Write`, `Edit`, `Read`, `Glob`, and `Grep` as first-class tools. They are cross-platform, they handle empty results cleanly, and they do not care which shell the host is running. Prefer them for every file-system interaction.

| Do NOT use `bash` for ...        | Use this dedicated tool instead                            |
|----------------------------------|------------------------------------------------------------|
| `mkdir -p dr-classify`           | Just call `Write` with path `dr-classify/main.go` — `Write` creates parent directories automatically. No separate mkdir needed. |
| `ls dr-classify/`                | `Glob` with pattern `dr-classify/**`                       |
| `ls -la dr-classify/`            | `Glob` with pattern `dr-classify/**`                       |
| `cat main.go`                    | `Read` with path `dr-classify/main.go`                     |
| `grep -r "foo" .`                | `Grep` with pattern `foo`                                  |
| `touch file.go`                  | `Write` with empty or starter content — there is no reason to create an empty file and then populate it in a separate step |
| `rm file.go`                     | Do not delete files unless explicitly asked. If you must, ask the user first. |

**Reserve `bash` for what shell is actually necessary for:**

- Running the compiler: `go build ./...`
- Running tests: `go test ./...`
- Running the built binary: `go run . 1 14 27`
- Invoking dev tools that produce structured output: `go vet ./...`, `go fmt -l .`

**Why this matters beyond the PowerShell mismatch — there is a second, sharper reason:**

OpenCode's tool-result pipeline has a schema rule that rejects **empty strings**: `body.messages.N.tool.content : String should have at least 1 character`. If a shell command produces zero bytes of stdout — e.g., `ls` on an empty directory, `grep` with no matches, `go test` when all tests are silent — OpenCode rejects its own tool message before sending it back to you, and the session errors out mid-turn. **`Glob`, `Read`, and `Grep` return structured results and never trigger this bug.** Shell commands can.

**If you must use `bash` and the command might return empty output, append a sentinel so stdout is never empty:**

```
go test ./... ; echo DONE
```

The trailing `echo DONE` guarantees at least one character of output regardless of whether `go test` was silent.

**On tool errors, read the error, form a hypothesis, adjust. Do not retry identically.** The PowerShell error for a failed `mkdir -p` is specifically telling you *the `-p` flag is not recognized* — the response is to switch to `Write` (creates dirs automatically), not to retry `mkdir` three more times.

---

## Discipline rules for AI agents working in this directory

1. **Do not add persona baggage.** No emojis in commit messages here. No warmth. No "have fun broseph." This workspace is sterile on purpose — it's measuring whether the discipline survives without external scaffolding. Save the warmth for Ananta.
2. **Every meaningful code change ends with an ELEGANCE_CHECK.** No exceptions. If you skip it, you've failed the experiment.
3. **Self-scores should be honest.** If the afternoon findings are correct, honest scores are usually 0.7-0.9, sometimes 0.95, rarely above. Score yourself like a skeptical senior engineer would score you, not like a relieved junior engineer congratulating themselves.
4. **Narrate reasoning concisely.** The v2 prompt failure mode is *over-narration that consumes the token budget before the code is written*. Say the minimum. Write the code. Score it. Stop.
5. **Trust the code, not the summary.** After compaction, re-read the actual files before making decisions. Do not rely on what the compaction summary says the code does.
6. **When the type signature can't represent the operation, revise the type — don't force-fit.** This is the adequacy axiom and it's non-negotiable.

---

## Deletion criteria

This workspace can be deleted at any time without affecting anything else. It's a sandbox. If you find yourself worried about losing state here, you're doing something wrong — valuable findings should be written to `C:\Projects\ananta\human_testing\CODEMATH_LAB_FINDINGS_*.md`, not left as ephemeral state here.

---

*Commander Sarat + Claude, April 11, 2026. This workspace exists to measure whether honesty survives compaction.*
