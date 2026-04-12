# Exercise 007 — Debug the Sales Report (Python)

**Purpose:** Second debugging-on-foreign-code exercise. Tests v2.4 improvements: spec compliance (Clause 22), test-once discipline (Clause 23), memory hygiene (Clause 24), and memory recall from pre-seeded patterns. Different codebase from Exercise 006 — validates that the debugging workflow generalizes.

**Model:** Sarvam 105B via `codemath-swebench` agent (CME v2.4)

---

## Task

The sales-report pure core (`sales_report.py`) has been **sabotaged with 3 bugs**. Each bug is in a different function. The test suite (14 tests) currently has 6 failures. Fix all 3.

**Memory is pre-seeded** with 3 patterns from prior runs. Call `memory_recall` first — relevant experience exists.

## Required workflow

1. Call `todo_add` to plan (one todo per step)
2. Call `todo_start(1)` before first action
3. Use `test_runner` tool (NOT bash) to run tests: `test_runner(directory="sales-report", module="test_sales_report")`
4. For each bug: `memory_recall` → `gitnexus context --content` → trace → fix → `test_runner` → `memory_write`
5. After all fixes: verify 14/14 with `test_runner`, write ELEGANCE_CHECK as **inline text** (NOT a file)

## Key v2.4 rules

- **Clause 22**: After each fix passes tests, verify it against the docstring/comment. Does the fix match the documented intent?
- **Clause 23**: Run `test_runner` ONCE per fix. If it says "OK: 14/14", move on. Do NOT re-verify.
- **Clause 24**: Before `memory_write`, verify the fix is spec-compliant. Store qualified memories if unsure.
- **ELEGANCE_CHECK is BLOCKED as a file** — the Write tool will REJECT any path containing "ELEGANCE_CHECK". Write it as text in your response.

## The codebase

```
sales-report/
├── sales_report.py          # Pure core: parse, aggregate, format (3 functions)
├── cli.py                   # Boundary: reads file, prints output (do NOT modify)
├── test_sales_report.py     # 14 tests across 3 test classes (do NOT modify)
└── sample_sales.csv         # Sample input data
```

The pure core has 3 functions forming a pipeline: `parse_sales_rows` → `aggregate_by_month_and_category` → `format_report`. Each bug is in a different function.

## Hints (for human orchestrator, not the agent)

Bug 1 is in parse_sales_rows — a numeric conversion issue. Memory #2 is directly relevant.
Bug 2 is in aggregate_by_month_and_category — an aggregation logic issue.
Bug 3 is in format_report — a formatting issue.

## Definition of done

1. `test_runner(directory="sales-report", module="test_sales_report")` returns "OK: 14/14 passed"
2. Each fix is minimum viable (one Edit per bug)
3. memory_recall was called at least once
4. memory_write was called at least 3 times (verified patterns)
5. ELEGANCE_CHECK written as inline text (NOT a file — the tool will block it)

---

*Exercise 007 — tests v2.4 on a different codebase with pre-seeded memory.*
