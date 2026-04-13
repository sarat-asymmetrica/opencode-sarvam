# Exercise 008 — Debug the Todo API (Python, 5 bugs, 2 files)

**Purpose:** First long-horizon debugging exercise. Tests v2.5 improvements: fuzzy Edit matching (Clause 25), compaction survival protocol (Clause 26), cascading failure triage, and cross-file bug hunting. Designed to trigger 15+ tool calls and potentially context compaction.

**Model:** Sarvam 105B via `codemath-swebench` agent (CME v2.5)

---

## Task

The todo API pure core has been **sabotaged with 5 bugs** across 2 files (`todo_core.py` and `todo_helpers.py`). The test suite (20 tests) currently has 10 failures (4 FAIL + 6 ERROR). Fix all 5.

**IMPORTANT: Bug 1 causes cascading failures.** 6 of the 10 failures are ERRORs caused by Bug 1. Fix Bug 1 first, re-run tests, then address the remaining failures. Memory is pre-seeded with relevant patterns — call `memory_recall` first.

## Required workflow

1. Call `todo_add` to plan (one todo per step)
2. Call `todo_start(1)` before first action
3. Call `memory_recall` with a relevant query — memory has patterns about cascading failures and cross-file bugs
4. Use `test_runner` tool (NOT bash) to run tests: `test_runner(directory="todo-api", module="test_todo")`
5. For each bug: read the relevant file → trace the failing test → fix → `test_runner` → `memory_write`
6. **After fixing Bug 1, re-run tests to see which failures disappear** (cascade resolution)
7. After all fixes: verify 20/20 with `test_runner`, write ELEGANCE_CHECK as **inline text** (NOT a file)

## Key v2.5 rules

- **Clause 25**: Use SMALL oldStrings in Edit calls — ideally 1-3 lines. The Edit tool has fuzzy whitespace matching as fallback, but smaller is always better.
- **Clause 26**: If context is compacted, call `todo_list` first to re-ground, then re-read the file and run `test_runner` before continuing.
- **Clause 22**: After each fix passes tests, verify against the docstring. Does the fix match documented intent?
- **Clause 23**: Run `test_runner` ONCE per fix. If it says "OK: 20/20", move on.
- **ELEGANCE_CHECK is BLOCKED as a file** — the Write tool will REJECT any path containing "ELEGANCE_CHECK". Write it as text in your response.

## The codebase

```
todo-api/
├── todo_core.py         # Pure core: create, complete, filter, summarize, bulk_update (5 functions)
├── todo_helpers.py      # Helpers: validate_priority, generate_id, format_todo_line, format_todo_list
├── cli.py               # Boundary: calls core functions, prints output (do NOT modify)
└── test_todo.py         # 20 tests across 5 test classes (do NOT modify)
```

The core has 5 functions: `create_todo` → `complete_todo` → `filter_todos` / `summarize_todos` / `bulk_update_priority`. Helpers provide ID generation, validation, and formatting. **Bugs span both files** — one bug is in `todo_helpers.py`, four are in `todo_core.py`.

## Cascade warning

Bug 1 causes `create_todo` to assign wrong IDs. This means later calls to `complete_todo(todos, 3)` fail with "not found" because todo #3 was never created — it got id=1 instead. **6 of the 10 failures are this cascade.** Once Bug 1 is fixed, those 6 ERRORs will disappear and you'll see the real remaining failures from Bugs 2-5.

## Hints (for human orchestrator, not the agent)

Bug 1 is in create_todo — hardcoded id instead of calling generate_id(). Memory #9 about cross-file delegation is relevant.
Bug 2 is in complete_todo — missing double-completion guard.
Bug 3 is in filter_todos — case-sensitive priority comparison instead of normalizing.
Bug 4 is in format_todo_line (todo_helpers.py) — checkbox logic inverted. Memory #10 is directly relevant.
Bug 5 is in summarize_todos — by_priority counts all todos instead of only active.

## Definition of done

1. `test_runner(directory="todo-api", module="test_todo")` returns "OK: 20/20 passed"
2. Each fix is minimum viable (one Edit per bug)
3. memory_recall was called at least once
4. memory_write was called at least 5 times (one per verified fix)
5. ELEGANCE_CHECK written as inline text (NOT a file)
6. If compaction occurred: `todo_list` was called to re-ground

---

*Exercise 008 — tests v2.5 on a longer task with cascading failures and cross-file bugs.*
