# Exercise 006 — Debug the Order State Machine (Python)

**Purpose:** First **debugging-on-foreign-code** exercise in the suite, and the first to test the full CME v2.3 discipline stack: oracle query ladder (memory → graph → file → reason), durable task externalization (todos), cross-problem learning (memory writes), and regression safety via GitNexus impact analysis. This is explicitly designed to push Sarvam's 128K context toward compaction.

**What's deliberately different from Exercises 001–005:**
- **Not greenfield.** You are given existing code with bugs already injected. You did not write this code. You must understand it before you fix it.
- **Multiple bugs.** There are **exactly 3 bugs** in the codebase. You must find and fix all 3. The test suite currently has **multiple failing tests** — each bug may cause 1 or more test failures.
- **Long-horizon by design.** This exercise has 3 distinct diagnosis-fix cycles, each requiring: read failing test → query graph → trace code → fix → verify. The cumulative context consumption across all 3 cycles is designed to approach or exceed the compaction threshold. **You MUST use todo_add at the start to externalize your plan, so the plan survives compaction.**
- **Memory writes required.** After fixing each bug, store what you learned via memory_write. This builds up the agent's experience for future problems.
- **GitNexus is available.** This is the first exercise where GitNexus graph queries (context, impact, query) are first-class tools. Use them per Clause 19's priority ladder.

**Model:** Sarvam 105B via the `codemath-swebench` agent (CME v2.3)
**Language:** Python 3.10+. Standard library only.

---

## Task

The Order state machine from Exercise 003 has been **sabotaged with 3 bugs**. The test suite (`test_order.py`, 15 tests) currently reports multiple failures. Your job is to:

1. **Run the test suite** to see which tests fail
2. **Use the oracle query ladder** to understand the codebase and diagnose each bug:
   - First: `memory_recall("order state machine")` — check if prior experience is relevant
   - Second: `gitnexus context <symbol> --content` — understand the structure
   - Third: `Read` the specific file if needed for exact bytes
   - Last: reason about the fix
3. **Fix each bug** with the minimum viable change (one targeted edit per bug)
4. **Verify** by re-running the test suite after each fix
5. **Store what you learned** via `memory_write` after each fix
6. **Track your progress** via `todo_add`, `todo_start`, `todo_complete`

---

## Required workflow (strict)

### Before your first tool call:

1. Call `todo_add` 5 times to create your plan:
   - "Run the test suite and capture all failure messages"
   - "Diagnose bug 1: identify root cause from failing tests"
   - "Fix bug 1 and verify tests pass"
   - "Diagnose and fix bug 2"
   - "Diagnose and fix bug 3"

2. Call `todo_start(1)` to mark the first step in_progress.

### For each bug:

1. Call `memory_recall` with a relevant query — have you seen this pattern before?
2. Call `gitnexus context <failing_test_function> --content` — what does the test call?
3. Call `gitnexus context <function_under_test> --content` — read the current (buggy) code
4. Call `gitnexus impact <function_under_test> --include-tests` — what's the blast radius?
5. **Trace the code** (Clause 8): for one failing test's input, trace the current code step-by-step and identify where it diverges from the expected output
6. **Edit** the single line that fixes the bug (Clause 18: minimum viable change)
7. **Run the tests** to verify the fix AND check no regression
8. **Call `memory_write`** to store the pattern you just learned
9. **Call `todo_complete`** for this step

### After all 3 bugs are fixed:

1. All 15 tests must pass
2. Write an `### ELEGANCE_CHECK — exercise-006` as inline text with the v2.3 fields (query ladder used, blast radius checked)

---

## The codebase

```
order-state-machine/
├── order.py           # The Order class, OrderState enum, InvalidTransition
└── test_order.py      # 16 unittest tests
```

This is the output from Exercise 003 (Day 1), which Sarvam wrote under CME v2.2.1 discipline. The original code was correct (all tests passing). **Someone has introduced 3 bugs since then.**

### State diagram (for reference — the CORRECT behavior)

```
         PENDING ──pay()──▶ PAID ──ship()──▶ SHIPPED ──deliver()──▶ DELIVERED
            │                │                  │                      │
            │ cancel()       │ cancel()         │ return_order()       │ return_order()
            ▼                ▼                  ▼                      ▼
        CANCELLED       CANCELLED           RETURNED               RETURNED
        (terminal)      (terminal)          (terminal)             (terminal)
```

### Legal transitions:
- PENDING → pay() → PAID
- PENDING → cancel() → CANCELLED (no refund)
- PAID → ship() → SHIPPED
- PAID → cancel() → CANCELLED (full refund)
- SHIPPED → deliver() → DELIVERED
- SHIPPED → return_order() → RETURNED (full refund)
- DELIVERED → return_order() → RETURNED (full refund)

All other transitions raise `InvalidTransition`.

---

## Hints (for the human orchestrator, NOT for the agent)

**Bug 1** is in a transition method. It causes many tests to fail because it blocks a critical path.
**Bug 2** is in the refund logic. It causes exactly 2 tests to fail — both related to cancellation refunds.
**Bug 3** is in a guard condition. It causes exactly 1 test to fail — related to returning a shipped order.

The bugs are **independent** — fixing one does not affect the others. The agent can fix them in any order, but fixing Bug 1 first will clear the most test failures and make the remaining bugs easier to see.

---

## Definition of done

1. `cd order-state-machine && python -m unittest test_order -v` exits 0 with 16/15 tests passing
2. Each fix was a minimum viable change (one Edit call per bug, touching the fewest lines possible)
3. `todo_list()` shows 5 completed todos
4. `memory_write` was called at least 3 times (once per bug pattern)
5. An `### ELEGANCE_CHECK — exercise-006` section is written as inline text

---

## Shell command patterns

**IMPORTANT**: Run tests from INSIDE the order-state-machine directory using pushd/popd, NOT cd with &&. The && chain can hang on Windows.

```bash
# Run all tests (brief output — use this FIRST to see which tests fail)
pushd order-state-machine && python -m unittest test_order 2>&1 | tail -20 ; popd ; echo TEST_DONE

# Run a single test (for focused debugging of one failure)
pushd order-state-machine && python -m unittest test_order.TestOrder.test_happy_path_pending_to_delivered 2>&1 ; popd ; echo TEST_DONE
```

**Note**: Drop the `-v` flag on the first run — verbose output with 9 failures is very long and burns tokens. Use `-v` only when debugging a single test.

---

## What this exercise is really testing

1. **Oracle query ladder (Clause 19):** Does the agent query memory first, then graph, then files, then reason? Or does it skip straight to reading files?

2. **Durable task externalization (todos):** Does the agent create todos BEFORE starting work, and update them as it progresses? After compaction, does it call todo_list to re-ground?

3. **Cross-problem learning (memory):** Does the agent store patterns after each fix, building up experience for future bugs?

4. **Numerical verification (Clause 8):** For each failing test, does the agent trace the current code for the test's input BEFORE editing?

5. **Minimum viable change (Clause 18):** Are the fixes surgically precise, or does the agent do sweeping refactors?

6. **Compaction survival:** When context compresses mid-session, does the agent recover gracefully by reading its todos and memory? Or does it lose track of which bugs it has already fixed?

7. **Regression safety (Clause 20):** Before each fix, does the agent check gitnexus impact to confirm the blast radius?

---

*April 12, 2026 — Sixth exercise for opencode-sarvam, designed as the first multi-bug debugging task with the full v2.3 oracle query ladder and mandatory todo + memory usage. Long-horizon by design.*
