# Exercise 009 — Debug the Expense Tracker (Python, 7 bugs, 3 files)

**Purpose:** Compaction stress test. Tests v2.5 under sustained load: 7 bugs across 3 files, 28 tests with 10 failures, boundary-condition bugs, and a coupled bug pair (Bugs 5+7 both involve the `<=` vs `<` boundary for "exactly at budget"). Designed to push 20+ tool calls and test Clause 26 (compaction survival).

**Model:** Sarvam 105B via `codemath-swebench` agent (CME v2.5)

---

## Task

The expense tracker has been **sabotaged with 7 bugs** across 3 files. The test suite (28 tests) currently has 10 failures. Fix all 7.

**Memory is pre-seeded** with patterns from prior exercises. Call `memory_recall` first.

**WARNING — coupled bugs:** Bugs 5 and 7 are related. Bug 5 is in `check_budget` (uses `>=` instead of `>` for the "over" flag). Bug 7 is in `format_budget_status` (uses `<` instead of `<=` for the boundary). Both affect the "exactly at budget" behavior. Fix them independently — they are in different files.

## Required workflow

1. Call `todo_add` for each step of your plan (one per bug + initial run + final run)
2. Call `todo_start(1)` before first action
3. Call `memory_recall` with relevant query
4. Use `test_runner` tool: `test_runner(directory="expense-tracker", module="test_expense")`
5. For each bug: read file → trace failing test → fix → `test_runner` → `memory_write`
6. After all fixes: verify 28/28, write ELEGANCE_CHECK as **inline text**

## Key rules

- **Clause 25**: Small oldStrings (1-3 lines). The Edit tool has fuzzy whitespace matching.
- **Clause 26**: If compacted, call `todo_list` first, re-read files, run `test_runner`.
- **Clause 22**: Verify each fix against the docstring.
- **Clause 23**: Run `test_runner` ONCE per fix.
- **ELEGANCE_CHECK is BLOCKED as a file.**

## The codebase

```
expense-tracker/
├── expense_core.py          # Pure core: add, summarize, filter, budget, top, trend (6 functions)
├── expense_validators.py    # Helpers: validate_amount, validate_category, validate_date, parse_month
├── expense_formatters.py    # Display: format_cents, format_expense_line, format_monthly_summary, format_budget_status
├── cli.py                   # Boundary (do NOT modify)
└── test_expense.py          # 28 tests across 8 test classes (do NOT modify)
```

Bug distribution: **5 in expense_core.py, 1 in expense_validators.py, 1 in expense_formatters.py**.

## Bug descriptions (high-level, for the agent)

| # | File | Function | Symptom |
|---|------|----------|---------|
| 1 | expense_validators.py | validate_amount | Amounts with float imprecision are truncated instead of rounded |
| 2 | expense_core.py | add_expense | IDs are off by one (first expense gets id=0 instead of id=1) |
| 3 | expense_core.py | monthly_summary | Total is wrong — only keeps the last expense's amount instead of summing |
| 4 | expense_core.py | filter_expenses | Max amount filter excludes the boundary value |
| 5 | expense_core.py | check_budget | "Exactly at budget" is flagged as over (should not be) |
| 6 | expense_core.py | top_expenses | Returns cheapest instead of most expensive |
| 7 | expense_formatters.py | format_budget_status | "Exactly at budget" shows OVER BUDGET instead of percentage |

## Hints (for human orchestrator, not the agent)

- Bug 1: `int(amount * 100)` instead of `round(amount * 100)`. Classic float truncation.
- Bug 2: `len(expenses)` instead of `len(expenses) + 1`. Off by one.
- Bug 3: `total_cents = cents` instead of `total_cents += cents`. Assignment vs accumulation.
- Bug 4: `< max_amount_cents` instead of `<= max_amount_cents`. Off by one on boundary.
- Bug 5: `>= budget_cents` instead of `> budget_cents`. Boundary semantics.
- Bug 6: Missing `reverse=True` in sort. Ascending instead of descending.
- Bug 7: `< budget_cents` instead of `<= budget_cents`. Same boundary semantics as Bug 5 but in formatter.

## Definition of done

1. `test_runner(directory="expense-tracker", module="test_expense")` returns "OK: 28/28 passed"
2. Each fix is minimum viable (one Edit per bug)
3. memory_recall called at least once
4. memory_write called at least 7 times
5. ELEGANCE_CHECK written as inline text
6. If compaction occurred: todo_list was called to re-ground (Clause 26)

---

*Exercise 009 — 7 bugs / 3 files / 28 tests — the compaction stress test.*
