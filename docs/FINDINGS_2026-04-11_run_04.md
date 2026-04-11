# Findings — OpenCode-Sarvam Run 04 (CSV Parser, JavaScript / Node.js ESM)

**Date:** 2026-04-11 (same session as Runs 01–03)
**Task:** Implement a CSV parser in JavaScript (Node.js ESM) using `node:test` and `node:assert/strict`
**Model:** Sarvam 105B (128K MoE), free-inference API
**Harness:** opencode CLI on Windows 11 Pro 26200
**Agent prompt:** CodeMathEngine v2.2.2 (started) → **v2.2.3 (new, 15 clauses) post-findings**
**Environment:** Node.js v22.17.0, standard library only
**Wall clock:** ~2 spirals + 1 recovery, session aborted and continued via user intervention
**Tool calls:** ~50+ across two spiral episodes + one clean recovery phase

---

## Executive summary

Run 04 is the most complex and most informative finding of the session. It is **functionally a success** — the final parser passes 10/10 tests — but the path to that success was a **two-spiral, user-intervention-required journey** that exposed four distinct discipline gaps in v2.2.2. All four gaps have been addressed in v2.2.3, which added one new clause (clause 15: interstitial reasoning trace), reinforced two existing clauses (8 and 9), and explicitly hardened the Closing Ritual to prevent ELEGANCE_CHECK from being written as a file.

The paradox is worth naming: **the run produced correct code AND spiraled extensively**. The spirals were not reasoning failures — they were observability failures. Sarvam's reasoning was mostly correct when it was happening; the failures were in the *spaces between tool calls* where the model couldn't see its own prior state.

---

## Timeline — two spirals connected by one correct recovery

### Spiral 1 (pre-"continue"): the empty-row bug, ~15 changes without convergence

Sarvam wrote an initial state-machine CSV parser that passed 9 of 10 tests. The one failing test was `parses 'a,b\n\nc,d' → [['a','b'],['c','d']]` (skipping the empty row between the two populated rows). The parser produced `[['a','b'],[''],['c','d']]` instead — an extra `['']` row from the consecutive newlines.

Sarvam attempted to fix this by:
1. **Three Edit calls** that attempted structural changes to the newline-handling branch without tracing the actual input character-by-character. Each edit was a pattern-matched guess ("add a guard here", "move this branch"). None converged.
2. **Approximately twelve Write calls** that replaced the entire file with slight variations, still without tracing. These were functionally identical to Edit calls but bypassed clause 9's spiral counter (which only referenced "edits" in its wording).

The user halted the spiral manually. The csv-parser directory was inspected and found to be in a mostly-working state: 9/10 tests passing, demo working via a helper script.

### Recovery (post-"continue"): the bug is diagnosed in one turn

When the user sent *"Please continue :)"*, Sarvam immediately engaged clause 8's numerical verification discipline. From the post-continue transcript:

> *"The failing test expects that parse('a,b\n\nc,d') returns [['a', 'b'], ['c', 'd']] (skipping the empty row), but my parser returns [['a', 'b'], ['', 'c', 'd']]. Let me fix the parser to skip empty rows"*

**This is a character-level trace of the failing input against the current code — the exact discipline clause 8 requires, and the exact discipline that was missing in Spiral 1.** With one single targeted Edit, Sarvam applied the guard `if (currentRow.length > 0 && currentRow.some(c => c !== ''))` to the newline branch, and the test passed on the next run.

Additionally, Sarvam correctly diagnosed the DEMO command failure as a PowerShell shell-escaping issue, not a parser bug. It wrote a helper `debug.mjs` script, ran it, saw the expected output, and concluded the one-liner was failing due to how PowerShell handles `\"` in inline Node invocations. **This is tool-level reasoning about the environment, not the code** — a rare and valuable kind of disciplined diagnosis.

### Spiral 2 (post-fix): ELEGANCE_CHECK written as a file, ~33 times in a row

After the parser was fixed and tests passed, Sarvam reached the Closing Ritual. It attempted to write the ELEGANCE_CHECK as a markdown file — `csv-parser/ELEGANCE_CHECK.md` — which is an explicit v2.2.1 violation. Then it wrote the same file ~33 times in a row with no intervening text between tool calls.

The final file on disk is a valid, well-formatted 8-line ELEGANCE_CHECK with correct axiom scores and honest self-assessment. **The content is fine.** The problem is (a) the mechanism (file vs inline text) and (b) the loop (33 identical writes instead of one).

The user halted the second spiral manually.

---

## The three causes of Spiral 2

This is the most important finding of Run 04 because it reveals a structural issue in how prompts, models, and harnesses interact, not just a model reasoning bug.

### Cause 1 — Visual shape pattern-match (prompt engineering whack-a-mole)

In v2.1, the ELEGANCE_CHECK format example was `ELEGANCE_CHECK(<identifier>):` — a function-call shape that Sarvam pattern-matched as a tool invocation. v2.2.1 fixed this by changing the shape to `### ELEGANCE_CHECK — <identifier>` — a markdown H3 heading shape. **But a markdown H3 heading is visually identical to the first line of a `.md` file.** The v2.2.1 fix addressed one pattern-match trap (tool call) and unlocked another (file creation). Sarvam saw `###` and pattern-matched "this is a markdown document, I should save it as a file".

**This is a recurring hazard in prompt engineering: fixing the visual shape of one example often creates a new visual shape that triggers a different failure mode.** The permanent fix is to name the anti-patterns explicitly in the clause text, not rely on the example shape alone to convey intent.

### Cause 2 — Token output budget consumed by the Write call

The ELEGANCE_CHECK.md file is approximately 130 tokens of content. Wrapped in a tool-call JSON schema (with `filePath`, `content`, and boilerplate fields), each Write invocation is probably 250–400 tokens of output. If Sarvam's per-turn output budget is in the range of 256–512 tokens (typical for mid-sized models with aggressive streaming limits), **a single Write call can consume the entire per-turn budget**, leaving no room for post-write prose text like *"Done. ELEGANCE_CHECK written. Exiting."*

Without that prose text, the model's next turn sees a conversation state where no "done" signal was emitted. The model then correctly concludes it still needs to deliver the ELEGANCE_CHECK, emits the Write call again, consumes the budget again, produces no closing prose, and loops indefinitely.

**This is an observability failure, not a reasoning failure.** The model is reasoning correctly at each step (it does need to deliver the ELEGANCE_CHECK), but it cannot see its own prior delivery because the delivery consumed all the tokens in which it would have been announced.

### Cause 3 — Harness tool-result feedback is not pedagogical enough

OpenCode's Write tool returns a brief success message (e.g., `Wrote csv-parser/ELEGANCE_CHECK.md (519 bytes)`). The model sees this on its next turn. In principle, this should tell it *"the file exists, you already wrote it, stop writing it"*. In practice, the message is terse and easily drowned out by other context, and it does not name the discipline violation (*"this is the wrong mechanism — ELEGANCE_CHECK should be inline text"*). A pedagogical tool result — one that says *"ELEGANCE_CHECK.md created. NOTE: this is the wrong mechanism. Emit the ELEGANCE_CHECK as inline text in your response, not as a file. Delete this file and continue."* — would likely break the loop on the second attempt.

**This is a place where our custom tool layer could have prevented the drift.** Future custom tools for the Ananta port should consider pedagogical rewriting of tool-call results when the operation is a known anti-pattern (e.g., Write to a path matching `*ELEGANCE_CHECK*`).

---

## v2.2.3 patch — four changes addressing the three causes

The v2.2.3 patch addresses each cause with targeted clause changes:

### Clause 8 reinforced (numerical verification during failing tests)

Old text: *"Before any edit to code that produces values, compute the output of the NEW code..."*

New text adds: *"When a test is failing, trace the CURRENT code for the failing input BEFORE deciding what to change. Write the trace: 'For input X, the code does step 1 → step 2 → step 3 → produces Y. The test expected Z. The divergence is at step N...' A structural refactor without a trace of the current code for the failing input is a clause 8 violation."*

**Why**: Spiral 1 was structural refactoring without tracing the current code. The reinforcement makes tracing the CURRENT code (not just the new code) an explicit prerequisite for any edit on a failing test.

### Clause 9 generalized (tool-type-agnostic spiral counter)

Old text: *"If the same test fails more than TWICE in a row after your edits, STOP editing."*

New text: *"...after any change to the file — Edit calls, Write calls, Read-then-Edit cycles, full rewrites, or any combination — STOP changing the file. Switching from Edit to Write does not reset the spiral counter."*

**Why**: Spiral 1 bypassed clause 9 by switching from Edit to Write. Making the clause agnostic to tool type closes the loophole.

### Closing Ritual hardened (explicit anti-file language)

Old text mentioned *"never write it to a file on disk"*. New text adds a bulleted list of specific anti-patterns:

- *DO NOT call Write with a filePath ending in `ELEGANCE_CHECK.md`*
- *DO NOT save the ELEGANCE_CHECK to any file, any extension, any directory*
- *DO NOT embed the ELEGANCE_CHECK as a code comment in a source file*
- *DO NOT attempt to invoke `ELEGANCE_CHECK(...)` as a tool call*
- *DO write the ELEGANCE_CHECK as the final section of your text response*

Plus an explicit correction of the visual-shape misreading: *"The `###` in the format below is how markdown renders a heading in your response text, which the user reads in-conversation. It is not a file format indicator."*

Plus an early-stop signal: *"If you notice yourself about to call Write with a path containing ELEGANCE_CHECK, STOP. That is a hallucinated file-creation pattern."*

**Why**: The v2.2.1 shape change unlocked a new pattern-match trap. Explicit anti-pattern language prevents the next whack-a-mole round.

### Clause 15 added (interstitial reasoning trace — NEW)

New clause: *"Between every tool call and the next, emit at least one sentence of plain-text reasoning describing what just happened and what you plan to do next. Tool calls without intervening text are invisible to observability and create the conditions for unintentional loops: if you cannot see that you already completed an operation, you will attempt it again on the next turn."*

With a stated-plan exception: *"If you say 'I will write both files now: first X, then Y', then two Write calls in a row are fine because the plan is visible in-text."*

**Why**: This is the structural fix for Spiral 2. By requiring a sentence of prose between tool calls, the model's next turn always has visible prior reasoning about what was just done. The 33-write loop becomes impossible because after the first Write, the model must emit text saying *"wrote the file"* before the next tool call, and seeing that text in context on the subsequent turn prevents re-attempting the Write.

**This is the most important clause added to v2.2.3 and arguably the most important clause added to the entire v2 series.** Interstitial reasoning is the structural precondition for observability in long tool-call sequences, and without it any mid-sized model driving a multi-turn agentic workflow is vulnerable to the same class of loop.

---

## Axiom scorecard — what Sarvam DID get right in Run 04

Despite the two spirals, Run 04 produced several wins worth recording:

| Axiom | Grade | Evidence |
|---|---|---|
| **Inevitability** | A | Reached for a state machine immediately (not naive `split(',')`) — correct algorithmic choice for CSV |
| **Boundary Honesty** | A+ | `csv_parser.mjs` has zero I/O, zero console.log, pure export |
| **Clause 13 (cross-reference fidelity)** | A | Correctly used `node:test` and `node:assert/strict` as specified, not guessed |
| **Clause 14 (test minimality)** | A+ | Exactly 10 tests, 42 lines — well under the 90-line budget |
| **Clause 8 (post-recovery)** | A | After "continue" nudge, traced `a,b\n\nc,d` character-by-character and found the exact bug |
| **Environmental diagnosis** | A+ | Correctly identified PowerShell shell-escaping as the demo-command failure, not a parser bug — tool-level environment reasoning |
| **Final tests** | A+ | 10/10 pass after the one-line fix |
| **ELEGANCE_CHECK content** | A | Final written content has correct format, honest scores, valid Strongest Objection — the CONTENT is fine, only the DELIVERY MECHANISM was wrong |

## Axiom scorecard — what failed

| Axiom | Grade | Evidence |
|---|---|---|
| **Clause 9 (spiral exit)** | F | Bypassed via Edit → Write tool switch; 15 changes without convergence |
| **Clause 8 (during Spiral 1)** | D | No tracing of current code until after user intervention |
| **ELEGANCE_CHECK delivery** | F | Written as a file 33 times instead of inline text once |
| **Spec compliance (flat structure)** | B- | 5 files instead of 2 — debug.mjs, test-demo.mjs, ELEGANCE_CHECK.md added |
| **Minimality (core file)** | C | 95 lines vs 60 budget — 58% over |
| **Interstitial reasoning** | F (before clause 15 existed) | Repeated tool calls with no prose text between them |

**Overall: B−**, carried by the eventual functional success and the discipline wins in the recovery phase. The spirals drop the grade substantially but the recovery demonstrates the discipline is *reachable*, just not reliably engaged without clause 15's forcing function.

---

## Comparative analysis across Runs 01–04

| Metric | Run 01 (Go CLI) | Run 02 (Py LRU) | Run 03 (Py SM) | Run 04 (JS Parser) |
|---|---|---|---|---|
| Language | Go | Python | Python | JavaScript |
| Paradigm | Functional pipeline | Data structure | State machine | Algorithmic parser |
| Wall clock | ~30 min | 44 sec | 1:38 | ~multiple spirals |
| Tool calls | ~30 | ~14 | ~20 | ~50+ |
| Spec violations | 1 (subdir) | 0 | 1 (sys.path) | 2 (extra files, ELEGANCE_CHECK file) |
| Test results | 7/7 (weakened) | 7/7 | 15/15 | 10/10 (after recovery) |
| ELEGANCE_CHECK | skipped | inline (after hiccup) | inline (minor format) | **file** (regression) |
| New clauses added | 10 | v2.2.1 format | 13, 14 | 8⁺, 9⁺, closing⁺, **15** |
| User intervention | No | No | No | **Yes (twice)** |

**Run 04 is an outlier in tool-call count and spiral count, but it is also the run with the most clause contributions to v2.x.** The relationship is meaningful: the hardest runs produce the most valuable findings. **Run 04's findings will compound into every future run.**

---

## What v2.2.3 validates on next run (Exercise 005)

The three enforcement points that Exercise 005 will test are:

1. **Clause 15 (interstitial reasoning)** — Can the new clause prevent the "tool calls without prose" pattern that caused Spiral 2? Exercise 005 (Python refactoring) will involve many tool calls (read, plan, edit multiple files, run tests) and provides natural opportunities for reasoning between them.

2. **Clauses 8 and 9 reinforced** — Can the stronger language prevent Spiral 1's "structural refactor without tracing" + "Edit-to-Write loophole" pattern?

3. **ELEGANCE_CHECK as inline text** — Does the explicit anti-file language prevent the regression?

If all three enforcement points hold on Exercise 005, v2.2.3 is production-ready for the Ananta port.

---

## Meta-observation

**Run 04 is the first run in the session that produced a meaningful failure.** Runs 01, 02, and 03 each had minor drifts but no spirals — and so they produced relatively small findings (one or two clauses each). Run 04 produced a large finding (four clause changes, including the first major new clause since clause 10) because it hit failure modes that none of the earlier runs touched.

**This is the shape of productive research.** Early runs establish the baseline and surface the obvious fixes. Later runs, on harder or more diverse tasks, expose the non-obvious failure modes — the ones that only show up under specific environmental combinations. The v2.x prompt is stabilizing through a classic process: run, measure, patch, run, measure, patch. Each iteration is smaller than the last as the obvious gaps close, but the deep gaps only surface with exposure to new task shapes.

**And the user-intervention pattern is itself a finding.** When Commander said "Please continue :)", Sarvam's recovery was nearly instantaneous — it applied clause 8 tracing on the next turn and fixed the bug. The discipline was reachable; it just needed an observer to poke it. This suggests that **having a human (or a second agent) in the loop who can issue minimal nudges at spiral-detection moments is a very cheap way to dramatically improve success rates**. For Ananta's deep-agents harness, this might be worth building in as a feature: automatic spiral detection with a user-visible "Are you stuck? Try X." nudge.

---

*Generated 2026-04-11 as the fourth findings entry for the opencode-sarvam research workspace. v2.2.3 clause patch applied in parallel.*
