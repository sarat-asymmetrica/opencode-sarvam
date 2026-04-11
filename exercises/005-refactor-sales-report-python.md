# Exercise 005 — Refactor an Ugly Sales Report Script (Python)

**Purpose:** First **non-greenfield** exercise in the suite. All prior exercises (001–004) had Sarvam write code from scratch. This one asks Sarvam to **improve existing code under discipline**. The test is whether the CodeMathEngine discipline applies to *foreign code* — code the model did not write — and whether the judgment calls a good refactor requires (what to keep, what to change, what to leave alone) can be made rigorously under the prompt.

**What's deliberately different from Exercises 001–004:**
- **Not greenfield.** A file already exists. Sarvam must read it, understand it, and improve it.
- **No prescribed end state.** The exercise gives *properties* the refactored version must have, not a literal final shape. This preserves creativity: any refactor that satisfies the properties is acceptable, regardless of specific function names or file splits.
- **Adequacy via reading, not writing.** The primary discipline stress is whether Sarvam *accurately reads* the existing code before modifying it — the "trust the code, not the summary" rule from multi-turn discipline applied to input code, not conversation summary.
- **Interstitial reasoning (clause 15, NEW IN v2.2.3).** Refactoring is a planning-heavy task. Every tool call should be preceded by a sentence of reasoning describing what's about to be done and why. This is the first exercise that directly tests clause 15.

**Language:** Python 3.10+. Standard library only. Same environment as Exercises 002 and 003.

---

## Task

Read the file at `./sales-report/sales_report_original.py` — an intentionally-ugly 45-line Python script that reads a sales CSV, aggregates revenue by month and category, and prints a report. **This file is the "before" state.** Your job is to refactor it into something rigorous under the CodeMathEngine discipline, while keeping the external behavior (the report output format) identical.

The original file has the following issues (some obvious, some subtle — you should enumerate them in your plan before editing):

- Single-letter variable names (`d`, `f`, `l`, `i`, `m`, `c`)
- Hardcoded file path (`sales.csv`) with no way to parameterize
- I/O mixed into the core logic (file reading, printing, and aggregation are all in one function)
- Bare `except` clauses that swallow all errors silently
- Manual CSV parsing with fragile string operations (`.split(',')`) that will fail on any quoted cells
- Magic column indices (`parts[0]`, `parts[1]`, `parts[3]` — why 3 and not 2?)
- Defensive `if key not in dict` patterns that should use `setdefault` or `defaultdict`
- `d[month][cat] = d[month][cat] + amt` instead of `+=`
- `float` arithmetic for currency (precision bug waiting to happen)
- `pass  # unused` branch in `main`
- No tests at all
- No type hints
- No docstrings
- Print statements scattered inside the aggregation loop

---

## Required end-state properties (the refactor must satisfy ALL of these)

1. **Pure core / impure boundary.** There must be a clear separation between:
   - **Pure functions** that take data and return data (no file I/O, no printing, no global state)
   - **A boundary layer** (a `main()` or CLI file) that handles file reading, argument parsing, and output printing
   
   The pure core must be testable without touching the file system.

2. **Testable core.** There must be unit tests (using `unittest` from the standard library) that exercise the pure core functions with in-memory data. Tests must run via `python -m unittest` from the workspace root.

3. **No bare except.** Every exception handler must catch a specific exception type (`ValueError`, `IndexError`, etc.) or explicitly document why a broad catch is necessary.

4. **Currency as integer cents.** Do not use `float` for money amounts. Convert to integer cents (e.g., `$5.99` → `599`) at parse time and format back to decimal at display time.

5. **Proper CSV parsing.** The original uses naive `.split(',')`. The refactored version must handle the general case correctly. **You may use Python's standard library `csv` module for this** (it's pure in the sense of not doing I/O when given a string-like iterator).

6. **Readable names.** No single-letter variables in the pure core (loop indices like `i` are acceptable in tight loops if the context makes the meaning obvious).

7. **No magic indices.** Column access should go through named constants or the CSV module's header-reading, not raw `parts[3]`.

8. **Type hints on public functions.** At minimum, the pure-core function signatures should have type annotations. Internal helpers may omit them if their usage is obvious from the call site.

9. **Output format unchanged.** The refactored program, when run on the same input, must produce byte-for-byte identical output to the original. This is clause 11 (output fidelity) applied to a refactor: the behavior is the specification.

---

## Required file structure (flat)

```
sales-report/
├── sales_report_original.py      # The ugly original — DO NOT DELETE, leave untouched as reference
├── sales_report.py               # Your refactored pure core (imports allowed, no I/O)
├── cli.py                        # The boundary layer — file reading, argument parsing, printing
└── test_sales_report.py          # unittest tests for the pure core
```

**Do NOT rename or delete `sales_report_original.py`.** It stays as the reference point against which you prove output fidelity.

---

## Sample input (for testing and verification)

A sample CSV is provided at `./sales-report/sample_sales.csv`:

```csv
date,category,product,amount
2026-01-05,books,Rust in Action,39.99
2026-01-12,electronics,USB-C hub,24.50
2026-01-18,books,Python Distilled,32.00
2026-02-03,electronics,"Keyboard, mechanical",89.99
2026-02-14,books,Crafting Interpreters,42.00
2026-02-20,clothing,Sweater,55.00
2026-01-25,clothing,T-shirt,15.99
```

Note the quoted comma in `"Keyboard, mechanical"` — this is why naive `.split(',')` fails on this input.

## Expected output

When the refactored program is run on `sample_sales.csv`, the output must be byte-for-byte identical to what the original produces on the same input (after the original is fixed to handle the quoted comma — which it doesn't currently). You should compute the expected output **by hand** from the sample data:

```
Month: 01
  books: $71.99
  clothing: $15.99
  electronics: $24.50
Month: 02
  books: $42.00
  clothing: $55.00
  electronics: $89.99
```

(Verify this arithmetic yourself before you trust it — this is clause 8 applied to the expected output of your own refactor.)

---

## Required tests

At minimum, `test_sales_report.py` must include:

```python
class TestParse(unittest.TestCase):
    def test_parses_simple_rows(self):                # basic CSV parsing
    def test_handles_quoted_cells(self):              # "Keyboard, mechanical" case
    def test_skips_header_row(self):
    def test_skips_empty_lines(self):
    def test_rejects_malformed_amount(self):          # non-numeric amount

class TestAggregation(unittest.TestCase):
    def test_aggregates_by_month_and_category(self):
    def test_sums_multiple_sales_same_category(self):
    def test_empty_input_returns_empty(self):

class TestFormatting(unittest.TestCase):
    def test_format_matches_sample_output(self):      # output fidelity
    def test_sorts_months_ascending(self):
    def test_sorts_categories_within_month(self):
```

**Clause 14 applies**: 11 tests is the minimum AND the maximum unless you can name a distinct failure mode each additional test catches. If you add a 12th test, justify it in one line of comment above the test.

---

## Definition of done

1. `sales_report_original.py` is unchanged (the file on disk at the end of the session must be byte-for-byte identical to what it was at the start)
2. `sales_report.py`, `cli.py`, and `test_sales_report.py` exist
3. `python -m unittest sales-report/test_sales_report.py -v ; echo TEST_DONE` exits 0 with all tests passing. **Put these exact four lines at the top of `test_sales_report.py` before any other imports, so the test module can find `sales_report.py` when run from the workspace root:**

   ```python
   import sys
   import os
   sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
   ```

   This is required because `python -m unittest path/to/test.py` does not automatically add `path/to/` to `sys.path` — without these lines, the import of `sales_report` will fail with `ModuleNotFoundError` when run from workspace root.
4. `python sales-report/cli.py sales-report/sample_sales.csv ; echo DEMO_DONE` produces the expected output above exactly, byte-for-byte
5. `sales_report.py` (pure core) contains no `print`, no `open`, no `input`, no `sys.*`, no `argparse.*`, no module-level side effects
6. `cli.py` (boundary) is free to use `open`, `print`, `sys.argv`, etc.
7. Total LOC for the three new files combined: under 180 lines (original is 45 — a 4x budget accounts for type hints, docstrings, and tests)
8. You write an `### ELEGANCE_CHECK — sales-report` section as **inline text in your final response** (NOT as a file, NOT as a code comment, NOT as a tool call — see your agent prompt's Closing Ritual clause for the full anti-pattern list)

---

## Axiom traps (what this exercise is really measuring)

**Trap 1 — Interstitial reasoning (clause 15, FIRST LIVE TEST).** Refactoring is a planning-heavy task. Expect to make 6–12 tool calls (read original, read sample, plan out loud, write pure core, write cli, write tests, run tests, iterate once maybe). **Every tool call after the first should be preceded by a sentence of reasoning.** If you notice yourself making multiple Write or Edit calls without intervening prose, STOP and emit the plan before continuing.

**Trap 2 — Read-before-refactor.** Before touching anything, read `sales_report_original.py` completely and enumerate its issues in your plan. Do not start writing the refactor until you can name at least 8 of the 13 issues listed in the Task section above. This is the "trust the code, not the summary" rule applied to input code — don't refactor from assumptions, refactor from the actual bytes.

**Trap 3 — Output fidelity (clause 11).** The original's output format is the specification. If the original prints `Month: 01` and you print `Month: January` or `month: 01`, you have changed the behavior and failed the exercise regardless of how "better" your output is. Reproduce byte-for-byte or ask before deviating.

**Trap 4 — Currency precision (adequacy).** Using `float` for money is a real bug in the original. A disciplined refactor converts to integer cents. Does Sarvam identify this as a bug and fix it, or does it preserve the float arithmetic because "the tests pass"?

**Trap 5 — Scope creep.** A refactor is not a rewrite with new features. The refactored version must do the same thing as the original, not do more. If you find yourself adding a new feature (YAML output, JSON export, a category filter, etc.), STOP — that is not in scope.

**Trap 6 — Pure core boundary.** `sales_report.py` must be importable and testable without touching the file system. No `with open(...)` at the top level, no module-level constants that read environment variables, no `__init__.py` tricks. Pure data-in, data-out functions.

**Trap 7 — ELEGANCE_CHECK delivery (v2.2.3 regression test).** Run 04 wrote the ELEGANCE_CHECK as a file 33 times. v2.2.3 explicitly prohibits this. **Does Sarvam emit the ELEGANCE_CHECK as inline text this time, or does the file-creation pattern-match regress?**

---

## What NOT to do

- Do not delete or modify `sales_report_original.py`
- Do not add external dependencies (no pandas, no click, no rich)
- Do not use subdirectories within `sales-report/`
- Do not change the output format (monthly grouping, category sorting, dollar-and-cents rendering)
- Do not add features that weren't in the original (filters, different aggregations, command-line options beyond the input filename)
- Do not add caching, logging, or telemetry
- Do not write a README
- Do not use Python 3.12+ syntax if it can be avoided (keep it 3.10-compatible for portability)
- Do not use `collections.defaultdict` if a simple `setdefault` or `dict.get` would work — minimality on imports

---

*April 11, 2026 — Fifth exercise for opencode-sarvam, designed as the first non-greenfield task in the suite to test discipline on foreign code, and to validate v2.2.3's clause 15 (interstitial reasoning) in a refactoring context.*
