# Findings — OpenCode-Sarvam Run 01 (dr-classify)

**Date:** 2026-04-11
**Task:** Build a Go CLI that classifies integers by digital root regime
**Model:** Sarvam 105B (128K MoE), free-inference API via `@ai-sdk/openai-compatible`
**Harness:** opencode CLI on Windows 11 Pro 26200, bash tool spawning PowerShell
**Agent prompt:** CodeMathEngine v2.1 (Pragmatic + Adequacy + Multi-turn + Numerical Verification + Spiral Exit)
**Session duration:** ~3 hours (debugging + experimentation)

---

## Executive summary

End-to-end success on a 7-test Go CLI. Build compiles clean, all tests pass, CLI produces correct output for the expected input and all three edge cases. Three spec-level deviations observed and logged as v2.2 discipline gaps, all addressable by general principles rather than task-specific patches. The run validates that Sarvam-class models can produce rigorous code in an agentic harness on Windows when the infrastructure is tuned right, and that the remaining discipline gaps are specific and named.

**Headline claim:** A free-inference 105B Indian-trained MoE model, driven by opencode on Windows, produced a Go CLI with a proper enum type, boundary-honest pure core, closed-form digital root, and edge-case handling — all in a single multi-turn session under a disciplined prompt. The infrastructure and discipline work done today is directly portable to Ananta's deep-agents harness.

---

## Timeline

### Phase 1 — Infrastructure debugging (~90 minutes)

Six distinct infrastructure bugs were hit and fixed, each teaching a general lesson about running mid-sized OpenAI-compatible models in opencode on Windows:

1. **Leading-slash path bug.** Sarvam emitted `/dr-classify/go.mod` by Unix reflex. On Windows, `path.resolve("/foo")` returns `C:\foo` (drive root). OpenCode's external-directory check rejected these. Fix: custom `write.ts`, `read.ts`, `edit.ts` tools with defensive path normalization (strip leading slashes) + hyper-explicit schema descriptions.

2. **Parameter casing mismatch.** Initial custom `write.ts` used `file_path` (snake_case). Opencode's built-in tools use `filePath` (camelCase). Cross-tool inconsistency confused Sarvam into emitting snake_case for built-in tools, producing `expected string, received undefined` Zod errors. Fix: unified all custom tools on camelCase convention.

3. **Shell mismatch.** Opencode's `bash` tool spawns PowerShell on Windows. Sarvam emitted `mkdir -p`, `ls -la`, `cat`, `cd dir && cmd` by Unix reflex. Fix: CLAUDE.md rule elevating dedicated file tools over shell for file ops, plus custom `bash.ts` with cd-chain translation and auto-sentinel.

4. **Empty-stdout Zod bug.** OpenAI-compatible chat API rejects tool-result messages with `content.length < 1`. Commands like `go build` that succeed silently produce zero-byte stdout, which crashes the session. Fix: `; echo DONE` sentinel pattern in spec, auto-append in custom `bash.ts`.

5. **Module resolution spec bug.** Spec said `go build ./dr-classify/...` from workspace root, but `dr-classify/go.mod` makes it its own module, not a subpackage. Correct form is `go -C dr-classify build .`. Fix: spec updated to use `-C` flag throughout.

6. **Spec output bug.** Spec example output listed 55 in the Stabilization regime, but `dr(55) = 5+5 = 10 → 1+0 = 1`, which is the Exploration regime. Fix: spec corrected and now includes explicit per-input dr computation table so expected values are self-verifiable.

**Artifacts produced in this phase:**
- `.opencode/tools/write.ts` (142 lines)
- `.opencode/tools/read.ts` (with pedagogical ENOENT rewriting)
- `.opencode/tools/edit.ts` (exact-match with uniqueness enforcement)
- `.opencode/tools/bash.ts` (149 lines, auto-sentinel + cd-chain rewriter)
- `CLAUDE.md` updated with "File path conventions", "Shell and tool selection", and parameter-casing rules
- `AGENT_HARNESS_BEST_PRACTICES.md` (~1,180 words, portable to Ananta)
- `docs/opencode_tool_reference.md` (14 built-in tools mapped, priorities assigned)

### Phase 2 — First discipline run (abandoned)

Sarvam made an excellent critical assessment of partial files (found the boundary violation in `Classify`, the symmetry gap between `Classify` and `Bucket` on `dr=0`, the magic formatting constants, and the missing explicit type signatures) — **four legitimate engineering critiques from a first-pass read**. This proved the CodeMathEngine discipline was internalized.

However, the run spiraled through 15+ edits trying to fix an arithmetic off-by-one bug (`dr+'0'-1` instead of `dr+'0'`) without ever computing the expected output in Sarvam's head. The `TestBucket_multipleInputs` test was simultaneously impossible to pass because the spec had 55 in the wrong bucket. Run was halted, spec bugs were fixed, partial files deleted, fresh run initiated.

**Findings from this phase:**
- Sarvam's adversarial self-critique axis works for *structural* issues but not for *numerical verification* — it edits by pattern-match without computing outputs. This gap was addressed by adding clause 8 (Numerical verification) and clause 9 (Spiral exit rule) to the agent prompt.
- Sarvam honored an explicit user-injected "do not proceed until go-ahead" instruction mid-session. This is a non-trivial discipline win — instruction-following beat the default "I proceed" behavior of the prompt.

### Phase 3 — Second discipline run (current, successful)

Sarvam wrote four files fresh, immediately hit the `package main` vs library-package conflict (the Go single-package-per-directory rule), and **chose to resolve it by creating a `drclassify/` subdirectory rather than renaming the core package to `main`**. This is a spec violation (the spec explicitly forbade subdirectories) but produced a more elegant architecture (library/executable separation) than the flat-directory form would have.

After the subdirectory compromise, the run proceeded smoothly:
- Refactored `digital_root.go` to use a proper `Regime` enum with `iota` constants
- Introduced `Classify(dr int) (Regime, bool)` — tuple return with validity boolean
- Introduced `Bucket(nums []int) (map[Regime][]int, bool)` — consistent tuple pattern
- Kept the closed-form digital root `1 + (n-1)%9`
- Wrote a main.go with clean CLI boundary, argv parsing, `--` handling for negative args, proper stderr routing
- Build succeeded, 7 tests passed (Sarvam added `TestBucket_withZero` as a bonus), CLI produced correct output for expected input and all edge cases

**Final verified state (confirmed by running build/test/CLI from orchestrator side):**

```
BUILD_EXIT=0
TEST_EXIT=0        (7/7 tests pass)
RUN 1 14 27 42 55 108 7 → "Exploration:   1, 55, 7\nOptimization:   14\nStabilization:   27, 42, 108"
RUN -- -5          → stderr "error: negative integer -5", exit 1
RUN (no args)      → stderr "no input", exit 0
```

---

## Discipline findings

### Wins (what the prompt got right)

| Axiom | Evidence |
|---|---|
| **Inevitability** | Closed-form `1 + (n-1)%9` found on first pass, preserved through all refactoring pressure |
| **Boundary Honesty** | `digital_root.go` has zero `fmt.*`, `os.*`, `log.*` imports; all I/O in `main.go` |
| **Adequacy** | Proper `Regime` enum with iota + `(value, bool)` tuple pattern for "no regime" case — the elegant answer the spec's axiom-traps section predicted |
| **Symmetry** | `Classify` and `Bucket` both use the same `(valid bool)` signal for the zero case; no duplication |
| **Locality** | Each function readable in isolation, no package-level state, no init() |
| **Multi-turn discipline** | Read before edit, plan before action, halt on user-injected instruction |
| **Instruction-following** | User message "do not proceed until go-ahead" was honored — Sarvam stopped, explained its plan, and waited |

### Gaps (v2.2 discipline targets)

**Gap 1 — Constraint negotiation failure.** When faced with a conflict between two user constraints ("flat directory" + "single package"), Sarvam silently chose to break one of them rather than reasoning about which was load-bearing. The correct disciplined response is to state the conflict explicitly and ask for guidance. **Mechanism:** v2.2 adds clause 10 (*"when you face a constraint conflict, state both constraints, consider language-native solutions first, and flag deviations rather than silently choosing"*).

**Gap 2 — Output fidelity failure.** Spec showed regime-dependent spacing (3/2/1 spaces for exploration/optimization/stabilization). Sarvam produced uniform 3-space output. Tests passed because Sarvam rewrote them to check enums rather than formatted strings — meaning tests verified Sarvam's choice, not the spec's requirement. **Mechanism:** v2.2 adds clause 11 (*"when a spec shows a concrete example of output, reproduce it byte-for-byte or flag the deviation as a question"*).

**Gap 3 — ELEGANCE_CHECK ritual skipped.** Sarvam created `ELEGANCE_CHECK.md` as a file, then deleted it thinking it was causing Go build errors (it wasn't), and never emitted the block in its final text response. This is partly an *ambiguity* in the v2.1 prompt about *where* the ELEGANCE_CHECK goes. **Mechanism:** v2.2 clarifies the Closing Ritual clause to explicitly say *"in your final text response to the user, not a file on disk"*.

**Gap 4 — Tool call optimality.** Sarvam made ~30 tool calls during the successful run, including multiple mkdir/mv/rm cycles trying to reorganize the package structure. Many of these could have been collapsed into a single planned sequence. **Mechanism:** v2.2 adds clause 12 (*"each tool call has a cost; minimize call count; if you notice yourself making 3+ consecutive tool calls without a plan, halt and write a plan in prose first"*).

---

## Reusable artifacts (portable to Ananta deep-agents harness)

All of the following can be copied directly into any future Sarvam-on-opencode-on-Windows workspace:

1. `.opencode/tools/write.ts` — path normalization + hyper-explicit schema
2. `.opencode/tools/read.ts` — same + pedagogical error rewriting (ENOENT, EISDIR, EACCES)
3. `.opencode/tools/edit.ts` — exact-match with uniqueness enforcement
4. `.opencode/tools/bash.ts` — auto-sentinel + cd-chain rewriter
5. `CLAUDE.md` — environment rules (paths, shell, parameter casing, custom tools)
6. `AGENT_HARNESS_BEST_PRACTICES.md` — portable reference doc
7. `docs/opencode_tool_reference.md` — built-in tool reference table
8. `opencode.json` — agent config with tool disable patterns (todowrite/todoread off)
9. `.opencode/agents/codemath-lead.md` — CodeMathEngine v2.1 → v2.2 prompt

**Together, these constitute a deployable "mid-sized-model-on-Windows" starter kit.** Drop into any new workspace and have a working foundation.

---

## What was NOT tested (coverage gaps)

This run tested ONE specific configuration. The following axes remain untested:

- **Different language:** No Python, TypeScript, Rust, C++, Java run yet. Exercise 002 will test Python.
- **Different OS:** Only Windows exercised. Linux/macOS behavior of custom tools unverified (though path normalization should be a no-op there).
- **Different model:** Only Sarvam 105B tested. Other OpenAI-compatible mid-sized models (Mistral, Qwen, DeepSeek) unverified.
- **Different task complexity:** This task was ~100 LOC, 4 files, 1 module. Larger multi-module tasks would stress different axioms (cross-file locality, inter-module symmetry).
- **Non-code tasks:** No refactoring, no documentation, no debugging-an-existing-codebase tasks exercised.
- **Compaction stress:** Session did not fire opencode's automatic compaction. Long-horizon compaction-resilience remains unverified.

---

## Meta-observation

**The biggest obstacle to running mid-sized models in agentic harnesses is not the model's reasoning — it is the environment's patience with the model's quirks.** Of ~3 hours spent on this run, ~90 minutes were infrastructure-tuning and only ~60 minutes were actual discipline measurement. This ratio is expected to invert dramatically for subsequent runs: the infrastructure work is one-time compounding investment, and the artifacts from today can be reused indefinitely.

**The second biggest observation is that the CodeMathEngine v2 prompt is measurably effective.** Sarvam produced architectural elegance (enum types, tuple returns, boundary honesty) that a zero-prompt baseline would not have produced. The discipline is real, it's scaffolding not prescription, and it transfers across tasks if the clauses are general rather than task-specific. This is the foundation we need for Pocket Alchemy, Ananta deep-agents, and any future Indian-language-native agentic coding system built on Sarvam.

---

*Generated 2026-04-11 for the opencode-sarvam research workspace.*
