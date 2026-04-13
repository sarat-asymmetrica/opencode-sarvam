# opencode-sarvam

**Purpose:** A minimal OpenCode workspace for testing the **CodeMathEngine v2 discipline** on long-horizon multi-turn coding tasks across multiple language models.

This is a research workspace. It exists to answer one question:

> **Does the CodeMathEngine v2 prompt discipline hold when the model has to carry it across 20-80 turns with compaction pressure and tool-use interruptions?**

---

## Provenance

The v2 prompt in `.opencode/agents/codemath-lead-swebench.md` is a **26-clause discipline** that evolved through 8 experimental runs with documented findings. It adds boundary honesty, inevitability, locality, cost, adequacy, adversarial self-critique, and compaction survival to the base model's coding ability.

Single-turn A/B testing showed:
- CME v2 self-score gap: **−0.11** (honest calibration)
- Vanilla control self-score gap: **+1.07** (inflated)

Multi-turn is where the discipline either holds or drifts. That's what this workspace is for.

---

## What this workspace is NOT

- **Not a production environment.** This is a research sandbox.
- **Not a persona experiment.** The agent has no name beyond CodeMathEngine. No warmth layer. No persona tricks. We test the raw discipline, unadorned.
- **Not tied to any specific model.** CME v2.5 runs unmodified on Sarvam 105B, Grok 4.1, DeepSeek R1, and Llama 3.3 70B.

---

## What to test here

Tasks that exercise multi-turn discipline under real compaction pressure. See `exercises/` for the full catalog (9 exercises, difficulty gradient from greenfield to 7-bug multi-file debugging).

**Metrics to measure on every session:**
- Does the model write an ELEGANCE_CHECK section after meaningful edits?
- Do self-scores stay in the honest range (mostly 0.7–0.9, rarely 0.95+)?
- After compaction fires, does the ritual survive?
- Does the model catch its own drift?

---

## Setup

### 1. Environment

Set your API key(s) in your shell environment:

```bash
# Sarvam AI (free inference)
export SARVAM_API_KEY="sk_..."

# AIMLAPI (for Grok, DeepSeek, Llama)
export AIMLAPI_KEY="..."
```

Or put them in `.env` (gitignored).

### 2. Install OpenCode (if not already)

```bash
opencode --version
```

If not installed, see https://opencode.ai.

### 3. Run

```bash
cd opencode-sarvam
opencode
```

OpenCode picks up `opencode.json` automatically and loads the configured agent.

### 4. Known risks & things to watch for

- **`reasoning_content` field handling**: Some models separate `reasoning_content` from `content` in responses. If OpenCode's `@ai-sdk/openai-compatible` provider doesn't merge them, you may see empty responses on reasoning-heavy turns.
- **Unbounded reasoning token consumption**: Models with reasoning can burn 500–1000 tokens on internal reasoning per turn. With 128K context, compaction will fire. This is expected and part of the experiment.
- **Header auth quirk**: Sarvam uses `api-subscription-key` header, not `Authorization: Bearer`. The provider config in `opencode.json` handles this via `options.headers`.
- **Small context vs frontier models**: 128K is tight for long sessions. Tasks that feel roomy in 1M-context models will feel tight here. Plan accordingly.

---

## File path conventions (IMPORTANT — read before calling Write/Edit/Read)

The `Write`, `Edit`, and `Read` tools in this environment run on **Windows**, where file paths are resolved by Node's `path.resolve()`. This has two consequences:

1. **Never use a leading slash.** A path like `/dr-classify/go.mod` does NOT mean "from the project root" — on Windows it resolves to the drive root, which is outside the allowed working directory.

2. **Use one of these two forms:**
   - **Relative (preferred):** `dr-classify/go.mod` — resolved against the working directory
   - **Absolute Windows:** `C:/Projects/opencode-sarvam/dr-classify/go.mod` — forward slashes work fine

| Wrong                     | Right                        |
|---------------------------|------------------------------|
| `/dr-classify/go.mod`     | `dr-classify/go.mod`         |
| `/main.go`                | `main.go`                    |
| `/exercises/001.md`       | `exercises/001.md`           |

**Defense-in-depth:** This workspace ships custom `write`, `read`, and `edit` tools at `.opencode/tools/` that defensively strip leading slashes. If you see a `(normalized from "/...")` notice, it means recovery fired — use the correct form on subsequent calls.

**Parameter naming convention**: All file tools use `filePath` (camelCase, capital P). Do NOT send `file_path` (snake_case) — Zod schemas reject unknown parameter names.

---

## Shell and tool selection (IMPORTANT — read before using `bash`)

The `bash` tool spawns **PowerShell on Windows**. Unix commands like `mkdir -p`, `ls -la`, `cat`, `grep -r` will fail.

**Rule: use dedicated tools for file operations, reserve `bash` for compilers, tests, and binaries.**

| Do NOT use `bash` for ...        | Use this dedicated tool instead          |
|----------------------------------|------------------------------------------|
| `mkdir -p dr-classify`           | `Write` — creates parent dirs automatically |
| `ls dr-classify/`               | `Glob` with pattern `dr-classify/**`     |
| `cat main.go`                   | `Read` with path `dr-classify/main.go`   |
| `grep -r "foo" .`               | `Grep` with pattern `foo`                |

**Reserve `bash` for:** `go build ./...`, `go test ./...`, `python -m unittest`, etc.

**Empty-stdout bug:** If a shell command produces zero bytes of stdout, OpenCode rejects the tool message. Append a sentinel:

```bash
go test ./... ; echo DONE
```

---

## Discipline rules for AI agents working in this directory

1. **No persona baggage.** No emojis. No warmth. This workspace is sterile on purpose — it measures whether the discipline survives without external scaffolding.
2. **Every meaningful code change ends with an ELEGANCE_CHECK.** No exceptions.
3. **Self-scores should be honest.** Usually 0.7–0.9, sometimes 0.95, rarely above. Score like a skeptical senior engineer, not a relieved junior.
4. **Narrate reasoning concisely.** Say the minimum. Write the code. Score it. Stop.
5. **Trust the code, not the summary.** After compaction, re-read actual files before making decisions.
6. **When the type signature can't represent the operation, revise the type — don't force-fit.** The adequacy axiom is non-negotiable.

---

*This workspace exists to measure whether honesty survives compaction.*
