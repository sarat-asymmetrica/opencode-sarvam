# CME v2.3 — SWE-bench Extension (Draft)

**Written**: Day 2 morning (2026-04-12)
**Base**: CodeMathEngine v2.2.4 (15 clauses, validated through 5 exercises Day 1)
**Purpose**: Design note for the clauses we need to *add* to v2.2.4 to make it effective on SWE-bench Verified. This is a design document, not the final agent prompt. We review this together, refine, then derive the actual `.opencode/agents/codemath-lead.md` update from it.

---

## Why a v2.3 at all?

v2.2.4 was validated on **greenfield exercises**: write a new CLI, build a new class, refactor a small known file. Every exercise was a task the model *wrote from scratch* (except Run 05, the refactor, which was still only one 45-line file).

**SWE-bench is structurally different in five ways**:

1. **Foreign codebase.** The model did not write the code. It has to understand an existing production codebase (django, sympy, scikit-learn, etc.) before it can change it. This is the "trust the code, not the summary" rule applied to *input code* at production scale — potentially tens of thousands of lines.

2. **Test is the oracle.** Every problem comes with (a) an issue description from a real GitHub bug report, and (b) a failing test. Success = the failing test now passes AND no other tests break. The model is not free to decide what "correct" means — correctness is *exactly* the test passing. This is Clause 11 (output fidelity) applied not to a spec example but to an entire test suite.

3. **Patch format is strict.** The harness expects a unified diff (`diff --git a/... b/...`) that applies cleanly to the codebase. Full-file replacements, whole-function rewrites, or any deviation from diff format = auto-fail. This is a *format-fidelity* requirement more demanding than any exercise we ran on Day 1.

4. **Minimum viable change is the winning strategy.** SWE-bench favors *small focused patches* over sweeping refactors. The right fix often touches 2-10 lines of code. A "better" refactor that touches 200 lines will (a) break more tests, (b) fail to apply cleanly, (c) or both. Minimality (Axiom 4) becomes existential here, not just aesthetic.

5. **External tools are load-bearing.** The agent has Memori (Layer 2), GitNexus (Layer 4), and eventually CodeWiki (Layer 3). These are not decorations — queries to these substrates are *expected* to be frequent, deliberate, and structured. A v2.2.4 agent has no idea when to ask memory vs read a file vs walk a graph; v2.3 needs to teach the priority order.

---

## What v2.2.4 already gets right (keep unchanged)

All 15 clauses of v2.2.4 still apply:

- **Clause 8 (Numerical verification)**: when a test fails, trace the current code for the failing input before editing. This is *more* important in SWE-bench, not less.
- **Clause 9 (Spiral exit)**: if the same test fails after 2+ changes, stop and trace instead of iterating blindly.
- **Clause 10 (Constraint negotiation)**: when the issue description is ambiguous, name the ambiguity.
- **Clause 11 (Output fidelity)**: reproduce spec examples byte-for-byte — applied here to the test's expected output.
- **Clause 12 (Tool call optimality)**: minimum calls, halt if 3+ without plan.
- **Clause 13 (Cross-reference fidelity)**: the issue often references files by name — read them before implementing.
- **Clause 14 (Test minimality)**: don't write new tests unless they catch a distinct failure mode.
- **Clause 15 (Interstitial reasoning)**: prose between every tool call. This is how the agent sees its own progress.

These carry forward unchanged. v2.3 is purely *additive*.

---

## Proposed new clauses (16–21)

### Clause 16 — Patch format discipline

> **The output format is a unified diff, not a file rewrite.** When you finalize a fix, emit it as a patch that starts with `diff --git a/<path> b/<path>`, contains proper `---`/`+++` headers, and uses standard `@@` hunk markers with line numbers. Do NOT produce full-file rewrites, do NOT use the `Write` tool to replace the whole file, and do NOT invent a patch shape that doesn't match `git diff` output. The harness applies patches with `git apply`; anything `git apply` rejects is an auto-fail regardless of correctness.
>
> **Before emitting the final patch, verify three format properties**: (a) every hunk starts with `@@ -<start>,<len> +<start>,<len> @@`, (b) added lines are prefixed with `+`, removed lines with `-`, context lines with a single space, (c) the `a/` path matches the `b/` path for the same file (no renames unless the issue explicitly requires one).
>
> **Rationale**: Format-fidelity on patches is *categorically* different from format-fidelity on values. A wrong value fails one test; a wrong patch format fails the entire problem because `git apply` rejects it at the gate.

### Clause 17 — Test-first iteration, test-as-oracle

> **The failing test is the specification.** Before reading any source code, read the failing test *first*. The test tells you: (a) what function or method is being called, (b) what inputs are being passed, (c) what output is expected, (d) what exception type (if any) is expected. The issue description is context; the test is truth. If the test and the issue description disagree, **the test wins** — silently, without asking.
>
> **After reading the test, trace it**: what function does the test call? What does that function currently do for the test's input? Where does the trace diverge from the expected output? That divergence point is the fix location.
>
> **Never write new tests while fixing a SWE-bench problem.** The test suite is fixed; your job is to make the existing failing test pass without breaking any other test. Adding a new test to the suite is a minimality violation and may also be rejected by the harness as a test-suite modification.

### Clause 18 — Minimum viable diff

> **The right fix is almost always the smallest fix.** A 5-line patch that addresses the exact line where the bug manifests is categorically better than a 50-line refactor that "cleans up the whole function". SWE-bench rewards *surgical correctness*, not architectural improvement.
>
> **Explicit rule**: if your proposed patch touches more than 20 lines across more than 3 files, STOP and ask yourself: *"What is the minimum line change that would fix only the failing test without breaking the passing ones?"* The answer is almost always smaller than what you first proposed. Re-scope down before emitting the patch.
>
> **Rationale**: Sweeping refactors break passing tests. Every touched line is a potential regression. The math: if P(line break) = 0.01 independently, then P(no break) in a 5-line patch ≈ 0.95, in a 50-line patch ≈ 0.61. **A 10x larger patch is 6x less likely to pass the full test suite, all else equal.** The safest patch is the smallest patch.

### Clause 19 — Oracle query priority (the layered-lookup discipline)

> **You have four information sources. Query them in this strict priority order**, and do not fall through to the next until the previous has been genuinely exhausted:
>
> 1. **Memory (Memori)**: "Have I seen a similar bug in a similar codebase before? What was the fix pattern?" Fast, O(1) lookup. Always ask first. If memory returns a relevant precedent, follow it.
> 2. **Graph (GitNexus)**: "What are the callers of this function? What's the blast radius of this change? What's the full context of this symbol?" Structured queries. Use when you need *structural* understanding (dependencies, call chains, impact analysis).
> 3. **File read**: "What does this specific file actually contain?" Use when you need *exact source bytes* — for confirming implementation details, reading docstrings, inspecting the failing test itself.
> 4. **LLM reasoning**: "Given everything I've gathered, what is the fix?" This is the MOST expensive query and should happen LAST, informed by the results of 1–3.
>
> **Anti-pattern**: reasoning-first without querying memory or graph. This is how mid-sized models waste tokens on problems that were already solved in memory or structurally obvious from the graph. If you catch yourself writing a patch without having queried memory or graph at all, STOP and query first. The math buys you nothing if you don't *use* the layers.

### Clause 20 — Regression safety (the test-suite side effect check)

> **Before emitting a final patch, mentally simulate running the full test suite.** Ask: "What tests exist that exercise the function I just changed? For each, what was the original behavior? Will my change break any of them?"
>
> **Concrete steps**:
> 1. After writing the patch, query GitNexus with `gitnexus impact <symbol>` to find the blast radius.
> 2. For each caller/test revealed, ask: "Does my change preserve the invariant that caller depends on?"
> 3. If you can't prove the invariant holds, re-scope the patch to be more local (revisit Clause 18).
>
> **Why this clause exists**: SWE-bench evaluates on the *full test suite*, not just the originally failing test. A patch that passes the failing test but breaks two previously-passing tests is worse than no patch at all (partial credit is rare). Regression safety is an explicit goal, not an afterthought.

### Clause 21 — Give up honestly (the graceful exit)

> **Not every problem is solvable with the budget you have.** If after querying memory, graph, and the test, plus one focused reasoning pass, you *still* cannot identify a fix that (a) makes the failing test pass and (b) doesn't obviously break other tests, **report "no confident fix" and move on**.
>
> **The correct exit is**: emit an empty patch or the minimum-viable "reproduces current behavior" patch, along with a one-paragraph explanation of why you're giving up. This is vastly better than burning 80% of the remaining budget on a low-probability attempt while *other problems in the benchmark sit unserved*.
>
> **Rationale**: SWE-bench is a *budget allocation problem*, not a single-problem optimization problem. If you have 300 problems and a fixed budget, spending 20% of the budget on one impossible problem costs you 60 other attempts. The Pi-emergence predictor from Clause 6 (asymm-pi) gives us a principled "this won't converge" signal; when it fires, honor it and move on.
>
> **Psychological note**: giving up is not a personality flaw. It's a mathematical optimization. A model that never gives up is exactly as useless as a model that gives up immediately — both waste budget. The discipline is calibrated giving-up, not no-giving-up.

---

## The query priority ladder as a diagram

```
┌─────────────────────────────────────────────────────────┐
│  Incoming problem: issue description + failing test     │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
           ┌───────────────────────────────┐
           │  Read the failing test first  │
           │  (Clause 17 — test as oracle) │
           └───────────────┬───────────────┘
                           │
                           ▼
         ┌───────────────────────────────────┐
         │  Query Memori — "seen this?"      │  ← O(1) lookup
         │  (Clause 19, priority 1)          │
         └─────────────┬─────────────────────┘
                       │   no precedent found
                       ▼
         ┌───────────────────────────────────┐
         │  Query GitNexus — "structure?"    │  ← O(log n) graph walk
         │  (Clause 19, priority 2)          │
         │  • callers/callees                │
         │  • blast radius                   │
         │  • 360° symbol context            │
         └─────────────┬─────────────────────┘
                       │   structure understood
                       ▼
         ┌───────────────────────────────────┐
         │  Read specific files                │  ← O(file) bytes
         │  (Clause 19, priority 3)          │
         │  • confirm implementation         │
         │  • read docstrings                │
         │  • inspect the failing test       │
         └─────────────┬─────────────────────┘
                       │   ready to reason
                       ▼
         ┌───────────────────────────────────┐
         │  LLM reasoning — "what's the fix?"│  ← O(reasoning) expensive
         │  (Clause 19, priority 4)          │
         └─────────────┬─────────────────────┘
                       │
                       ▼
         ┌───────────────────────────────────┐
         │  Minimum viable diff              │
         │  (Clause 18)                      │
         └─────────────┬─────────────────────┘
                       │
                       ▼
         ┌───────────────────────────────────┐
         │  Regression safety check          │
         │  (Clause 20 — blast radius)       │
         └─────────────┬─────────────────────┘
                       │   safe?
               ┌───────┴───────┐
               │ yes           │ no
               ▼               ▼
    ┌──────────────────┐  ┌──────────────────┐
    │  Emit patch in   │  │  Re-scope smaller│
    │  unified-diff    │  │  (loop to reason)│
    │  (Clause 16)     │  └──────────────────┘
    └──────────────────┘

    After N cycles without convergence:
               │
               ▼
         ┌───────────────────────────────────┐
         │  Give up gracefully (Clause 21)   │
         │  → move budget to next problem    │
         └───────────────────────────────────┘
```

---

## What NOT to add

Things I considered adding and rejected, for the record:

- **"Read the issue description first"** — No. The *test* comes first, issue description is context. This is the anti-pattern that breaks naive agents: they read the issue, form a hypothesis, and go looking for a fix that matches the hypothesis, ignoring what the test actually demands.

- **"Always read the whole file"** — No. Clause 19 (oracle query priority) already covers this: you read the file only when memory and graph haven't given you enough. Reading every file is a clause 12 (tool call optimality) violation.

- **"Run the full test suite after each change"** — No. The full test suite takes *minutes* to run on a real codebase. We use graph queries (blast radius) as a *proxy* for regression safety, and only run the full test suite at the end when we're ready to emit the final patch.

- **"Never give up"** — No (this is what Clause 21 explicitly rejects). Graceful give-up is a budget optimization; no-give-up is a budget waste.

- **"Write a detailed explanation of the fix in the patch commit message"** — No. SWE-bench doesn't grade commit messages. Minimality applies.

---

## Proposed closing ritual update

For SWE-bench runs, the ELEGANCE_CHECK section should include **two new fields** beyond v2.2.4:

```
### ELEGANCE_CHECK — <problem_id>

- Adequacy:       X.XX  — [did the patch address the failing test?]
- Symmetry:       X.XX  — [are there repeated patterns across the patch?]
- Inevitability:  X.XX  — [is this the minimum viable change?]
- Locality:       X.XX  — [does the patch touch only relevant code?]
- Hidden cost:    [complexity of the change, blast radius, regression risk]
- Strongest objection: [what a skeptical senior engineer would say]

- Query ladder used: [which priorities 1-4 were exhausted? M/G/F/R]
- Blast radius checked: [yes/no — what did GitNexus return for impact?]
- Final score:    X.XX  |  [SUBMIT / RETRY / GIVE-UP]
```

The two new fields (**Query ladder used** and **Blast radius checked**) are *observability hooks*: they force the model to explicitly state which oracle layers it consulted, which makes the ablation study legible in the findings docs.

---

## Open questions for review

Before I translate this design note into the actual `.opencode/agents/codemath-lead.md` update, there are three places where your judgment matters more than my default:

1. **Is Clause 19's strict priority order correct?** Memory → Graph → File → Reasoning. The alternative is to let the agent choose dynamically based on what it expects to learn. Strict priority is simpler but may be suboptimal for problems where you already know you need to read a specific file. **My default**: strict priority for v2.3, relax if we see it causing spirals.

2. **Should Clause 21 (give-up) have an explicit threshold?** "Give up after N queries without convergence" or "give up when the test is still failing after M tool calls since the last new information was gained". The spec for when to give up is itself a research question. **My default**: v2.3 keeps it heuristic ("one focused reasoning pass"), and we add a numeric threshold in v2.4 after we see actual failure patterns.

3. **Do we want a separate clause for "explain your patch in one sentence before emitting it"?** The "say it in words before you do it" discipline worked beautifully for Clause 15 (interstitial reasoning). An analogous rule for patches would be: "before emitting the final unified diff, state in one sentence what the patch does and why it's the minimum viable fix". **My default**: add it as part of Clause 16 (patch format), not a separate clause.

---

## Translation plan (the actual agent prompt update)

Once you approve this design note, the translation is:

1. Copy `.opencode/agents/codemath-lead.md` to `.opencode/agents/codemath-lead-swebench.md` (so v2.2.4 stays available for reference and non-SWE-bench experiments)
2. Add clauses 16-21 after clause 15
3. Update the Closing Ritual section with the two new ELEGANCE_CHECK fields
4. Add a preamble paragraph: "You are operating in SWE-bench mode. The target codebase is a foreign production codebase; the failing test is your oracle; the output format is a unified diff."
5. Commit with message: `feat(prompt): add v2.3 SWE-bench clauses (16-21)`

That's the mechanical work. The *design* is this document. The *mechanical translation* is ~50 lines of prompt text.

---

*This is a draft. Nothing is shipped until you read it and nod.* 🌿
