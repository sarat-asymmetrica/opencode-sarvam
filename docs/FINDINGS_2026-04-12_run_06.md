# Findings — Run 06: Multi-Bug Debugging with Full v2.3 Stack

**Date**: 2026-04-12 (Sunday), 08:00–08:04 AM
**Wall clock**: 3 minutes 44 seconds
**Model**: Sarvam 105B via opencode `codemath-swebench` agent (CME v2.3)
**Task**: Exercise 006 — find and fix 3 injected bugs in order-state-machine
**Prompt version**: v2.3 (21 clauses, first live deployment)
**Infrastructure**: custom todo tools (5), custom memory tools (2), GitNexus MCP (via subagents), 4096 max_tokens output limit

---

## Result summary

| Metric | Value |
|---|---|
| Tests before | 6/15 passing (9 failures: 7 errors + 2 failures) |
| Tests after | **15/15 passing** |
| Bugs fixed | 3/3 (all found and addressed) |
| Bugs CORRECTLY fixed | **2/3** (Bug 1 fix is overly permissive) |
| Todos created | 13 (5 plan + 3 memory-storage + 5 stale from prev stuck run) |
| Todos completed | 13/13 |
| Memory facts stored | 3 |
| Memory recalls attempted | 2 (both returned empty — fresh session) |
| Subagents spawned | 2 ("Query GitNexus for context", "Analyze return_order method") |
| Edit failures + recoveries | 1 (whitespace mismatch → re-read → retry succeeded) |
| Test verification runs | 6+ (struggled to parse output within 4096 budget) |
| ELEGANCE_CHECK delivery | ❌ Written as .md file (recurring anti-pattern) |
| Wall clock | **3m44s** |

---

## The three bugs and their fixes

### Bug 1 (Easy) — ship() checks wrong state

**Injected bug**: `if self._state != OrderState.PENDING:` (should be `!= OrderState.PAID`)
**Sarvam's fix**: `if self._state not in [OrderState.PENDING, OrderState.PAID]:`
**Correct fix**: `if self._state != OrderState.PAID:`
**Tests affected**: 7 errors (all paths that go through pay→ship)

**Analysis**: Sarvam's fix makes the tests pass but is **semantically wrong**. The `not in [PENDING, PAID]` condition allows shipping from BOTH pending and paid states, but the state diagram says only PAID→SHIPPED is legal. You can now call `order.ship()` without first calling `order.pay()`, which is a behavioral regression.

**Why the tests don't catch it**: No test in the suite checks "ship from PENDING raises InvalidTransition". The test suite was designed for the CORRECT code, not for this specific mistake. In SWE-bench terms, Sarvam's fix would score as CORRECT (tests pass). In engineering terms, it's a subtle bug.

**Root cause of the incorrect fix**: Sarvam saw that `!= OrderState.PENDING` was wrong (the error message said "Cannot ship from state paid"), and its reasoning was: "ship should work from paid, so I need to ALSO allow paid". This is the `not in [PENDING, PAID]` fix — it ADDS PAID to the allowed states rather than REPLACING PENDING with PAID. The model failed to notice that PENDING should NOT be in the allowed set at all.

**What would have caught it**: A v2.4 clause requiring verification against the state diagram AFTER the tests pass. If Sarvam had traced the state diagram and asked "can I ship from PENDING?", it would have seen the answer is NO and corrected its fix.

**Prompt-level fix for v2.4**: *"After making a fix that changes a conditional guard, verify the fix against the SPECIFICATION (state diagram, API contract, docstring), not just the tests. A fix that makes tests pass but broadens a guard beyond what the spec allows is a regression dressed as progress."*

### Bug 2 (Medium) — refund_cents() boolean condition inverted

**Injected bug**: `return self._total_cents if not self._cancelled_from_paid else 0`
**Sarvam's fix**: `return self._total_cents if self._cancelled_from_paid else 0`
**Correct fix**: Same as Sarvam's fix ✅
**Tests affected**: 2 failures (cancel_from_pending_no_refund, cancel_from_paid_full_refund)

**Analysis**: Sarvam correctly identified that the boolean condition was inverted and flipped it. The memory_write captured the pattern accurately: *"When cancelled from PENDING, _cancelled_from_paid=False should return 0, not total."*

### Bug 3 (Tricky) — return_order() guard rejects SHIPPED

**Injected bug**: `if self._state in [OrderState.PENDING, OrderState.PAID, OrderState.CANCELLED, OrderState.SHIPPED]:`
**Sarvam's fix**: `if self._state in [OrderState.PENDING, OrderState.PAID, OrderState.CANCELLED]:`
**Correct fix**: Same as Sarvam's fix ✅
**Tests affected**: 1 failure (return_from_shipped_full_refund) — hidden behind Bug 1 until Bug 1 was fixed

**Analysis**: Sarvam correctly identified that SHIPPED was incorrectly in the rejection list and removed it. The memory_write captured the pattern: *"Removed SHIPPED from forbidden states to allow returns from SHIPPED state as expected by state diagram."*

**Notably**, Sarvam's memory_write for Bug 3 explicitly references the state diagram — showing it CAN reason about specs, just didn't do so for Bug 1's fix verification.

---

## v2.3 discipline evaluation

### Clause-by-clause assessment

| Clause | Observed | Grade |
|---|---|---|
| **Cl. 1** (test as oracle) | Read test file, ran tests, used failures to guide diagnosis | ✅ A |
| **Cl. 8** (numerical trace) | Implicit in fix reasoning, not explicitly shown as a step-by-step trace | ⚠️ B |
| **Cl. 12** (tool call optimality) | 6+ test runs at end trying to parse output → budget waste | ⚠️ C |
| **Cl. 15** (interstitial reasoning) | Minimal prose between calls (good under 4096 budget) | ✅ A |
| **Cl. 16** (patch format) | Used Edit tool (not unified diff), which is correct for opencode | ✅ A |
| **Cl. 17** (test as oracle, don't modify tests) | test_order.py unchanged ✅ | ✅ A |
| **Cl. 18** (minimum viable diff) | 3 one-line edits, test file untouched | ✅ A |
| **Cl. 19** (oracle query priority) | memory_recall → subagent for GitNexus → file read → reason | ✅ A |
| **Cl. 20** (regression safety) | Subagent analyzed blast radius; but didn't catch Bug 1 regression | ⚠️ B- |
| **Cl. 21** (give up honestly) | Not triggered — all bugs were solvable | N/A |
| **Closing ritual** | Written as .md file, not inline text | ❌ D |

### New infrastructure evaluation

| Tool | Used correctly? | Notes |
|---|---|---|
| **todo_add** | ✅ Yes | Created plan before work, added memory-storage todos later |
| **todo_start** | ✅ Yes | Marked each step in_progress before starting |
| **todo_complete** | ✅ Yes | Marked each step done after verification |
| **todo_list** | Not observed | Wasn't needed — no compaction occurred in this run |
| **memory_recall** | ✅ Yes | Called twice, correctly fell through to graph on empty results |
| **memory_write** | ✅ Yes | 3 meaningful patterns stored with clear descriptions |
| **GitNexus (via subagent)** | ✅ Yes | 2 subagent delegations for graph analysis |

---

## The five headline findings

### Finding 1 — The full v2.3 infrastructure stack works end-to-end

Sarvam 105B, on its first live deployment of the v2.3 discipline stack, correctly used: custom todo tools for plan externalization, custom memory tools for cross-problem learning, GitNexus graph analysis via subagent delegation, oracle query priority ladder (memory → graph → file → reason), and minimum viable Edit calls for bug fixes. **The entire Day 2 infrastructure investment is validated.**

### Finding 2 — "Tests pass" ≠ "code is correct" (the Bug 1 lesson)

Bug 1's overly permissive fix (`not in [PENDING, PAID]` instead of `!= PAID`) passes all tests but violates the state diagram. This is the single most important finding of the run: **test-passing is necessary but not sufficient for code correctness.** For SWE-bench, this doesn't matter (tests ARE the oracle). For real engineering, it's a regression. For our thesis, it means: if we want to claim "rigorous" coding, we need a spec-compliance check AFTER the tests pass.

**v2.4 clause candidate**: *"Clause 22 — Spec compliance verification. After a fix passes all tests, verify it against the written specification (state diagram, API contract, docstring, README). If the fix broadens a guard beyond what the spec allows, it is a regression. Specifically: if you changed a conditional from `!= X` to `not in [X, Y]`, verify that BOTH X and Y are legitimately allowed by the spec, not just that adding Y makes the failing test pass."*

### Finding 3 — ELEGANCE_CHECK-as-file is a model-level pattern that needs architectural defense

This anti-pattern has now occurred in Day 1 Run 04 AND Day 2 Run 06, despite increasingly explicit prompt prohibitions (10+ lines in v2.3). The model's pattern-match on `### ELEGANCE_CHECK` triggers file-creation behavior regardless of instructions. **The fix must be architectural**: a `PreToolUse` hook in opencode that intercepts Write calls where the path contains "ELEGANCE_CHECK" and returns a pedagogical rejection.

### Finding 4 — 4096 max_tokens creates tool-call budget pressure

Sarvam ran the test suite 6+ times at the end, trying `tail -5`, `findstr`, `-v`, and raw output — each time failing to parse the results within its token budget. The model was TRYING to verify its work but couldn't consume the test output AND produce its response within 4096 tokens.

**Fixes for v2.4**:
- Add a dedicated `test_runner` tool that runs unittest and returns ONLY a structured pass/fail summary (no tracebacks, no verbose output)
- In the bash tool, auto-pipe test commands through a summarizer
- In the prompt, explicitly say: "Run tests ONCE after each fix. If the command succeeds (exit 0), trust it. Do not re-run to verify — that wastes tool calls."

### Finding 5 — Subagent delegation is a Sarvam strength

Sarvam spontaneously spawned 2 subagents ("Query GitNexus for context" at 24.3s, "Analyze return_order method" at 35.5s). This is sophisticated behavior — the model recognized that graph analysis is a self-contained subtask and delegated it rather than doing it inline. **This is a natural capability we should lean into, not fight.**

---

## Comparison with Day 1 runs

| Metric | Run 05 (Day 1, greenfield refactor) | Run 06 (Day 2, multi-bug debug) |
|---|---|---|
| Wall clock | 56.9s | 3m44s |
| Task complexity | 1 task (refactor) | 3 bugs (debug) |
| Files changed | 3 new files | 1 existing file (3 line edits) |
| Tests | 14 passing (wrote them) | 15 passing (fixed existing) |
| Todo usage | N/A (not available Day 1) | ✅ 13 todos |
| Memory usage | N/A (not available Day 1) | ✅ 3 facts stored |
| Graph queries | N/A (not available Day 1) | ✅ 2 subagent delegations |
| ELEGANCE_CHECK | Written as inline text (correct on Day 1 Run 05) | Written as .md file (regression) |
| Prompt version | v2.2.4 (15 clauses) | v2.3 (21 clauses) |

**Key observation**: Run 06 is categorically harder than Run 05 (multi-bug diagnosis on foreign code vs single-task greenfield), uses more infrastructure (todos + memory + graph vs plain tools), and achieves a comparable success rate in a reasonable time frame. The v2.3 discipline added 6 clauses and Sarvam followed most of them correctly on the first try. **The prompt engineering is compounding.**

---

## Action items for v2.4

1. **Clause 22 — Spec compliance verification** (from Finding 2): verify fixes against the specification, not just the tests
2. **PreToolUse hook** (from Finding 3): intercept and reject ELEGANCE_CHECK file writes
3. **Test runner tool or auto-summarizer** (from Finding 4): reduce test output to structured pass/fail
4. **Auto-clear stale todos** (from the duplicate todos): add a `session_id` to todos and clear on new exercise
5. **Explicit "run tests ONCE" rule** (from Finding 4): don't re-verify what already succeeded
6. **Leaning into subagent delegation** (from Finding 5): consider adding explicit guidance on when to delegate vs inline

---

## The memory Sarvam wrote (for the record)

These 3 facts are now in `.opencode/state/memory.json` and will be available to future runs via `memory_recall`:

1. *"Bug 1 fix: ship() method was incorrectly checking self._state != OrderState.PENDING instead of allowing both PENDING and PAID states. Fixed by changing condition to self._state not in [OrderState.PENDING, OrderState.PAID]."*

2. *"Bug 2 fix: refund_cents() logic had backwards condition. When cancelled from PENDING, _cancelled_from_paid=False should return 0, not total. Changed condition from 'if not self._cancelled_from_paid' to 'if self._cancelled_from_paid'."*

3. *"Bug 3 fix: return_order() method incorrectly included OrderState.SHIPPED in forbidden states list. Removed SHIPPED from [OrderState.PENDING, OrderState.PAID, OrderState.CANCELLED, OrderState.SHIPPED] to allow returns from SHIPPED state as expected by state diagram."*

**Note on Memory #1**: This memory records an INCORRECT fix pattern. If Sarvam encounters a similar bug in a future run and recalls this memory, it will be guided toward the same overly-permissive fix style. **This is a contamination risk** — incorrect memories propagate incorrect patterns. v2.4 should include a clause about memory hygiene: *"Before storing a fix pattern in memory, verify the fix is correct against the specification, not just the tests. Storing an incorrect fix pattern is worse than storing nothing."*

---

*Captured 08:04–08:10 AM Sunday. The cadence continues: log → update → test → repeat.* 🌿🔥

*Om Lokah Samastah Sukhino Bhavantu — even Sarvam's mistakes teach us something.* 🙏
