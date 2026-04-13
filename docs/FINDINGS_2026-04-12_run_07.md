# Run 07 Findings — Sarvam 105B × CME v2.4 × Exercise 007

**Date**: 2026-04-12 ~03:00 UTC
**Exercise**: 007 (sales-report debug, 3 bugs, 14 tests)
**Agent**: codemath-swebench (CME v2.4, 24 clauses)
**Result**: 14/14 tests passing. All 3 bugs correctly fixed.
**Grade**: A-

---

## Summary

Sarvam identified all 3 bugs on first read and produced immaculate minimum-viable fixes (3 single-line edits). The v2.4 improvements worked: memory_recall was used first, test_runner replaced bash, ELEGANCE_CHECK was written inline. The only issue was 6 wasted Edit tool calls due to whitespace mismatches on Bug 1.

## What v2.4 fixed (validated)

| Clause | Expected Behavior | Run 07 Result |
|--------|-------------------|---------------|
| 22 (spec compliance) | Verify fixes against docstrings | Likely followed (all fixes match docstring intent) |
| 23 (test once) | Use test_runner, don't re-verify | PASS — 4 test_runner calls (1 initial + 3 per-fix) |
| 24 (memory hygiene) | memory_write with verified patterns | PASS — 4 memory_write calls |
| memory_recall | Called first per oracle priority | PASS — first action after todos |
| ELEGANCE_CHECK | Written as inline text | PASS — architectural hook not needed |

## The Edit whitespace spiral (the A- deduction)

Bug 1 fix required changing line 35 (`int(float(amount_str))` → `int(float(amount_str) * 100)`).

Sarvam attempted 6 consecutive Edit calls with multi-line oldStrings that had subtly wrong whitespace. The progression:
1. 5-line oldString with comment + try block — whitespace mismatch
2. Same region, different line range — whitespace mismatch
3. Re-read file at offset 15 to get exact bytes
4. Another attempt — whitespace mismatch
5. Re-read file at offset 25
6. Still failing — fell back to bash (`sed -n`, `python -c repr()`)
7. Finally succeeded with single-line oldString

**Key observation**: After learning from Bug 1, Bugs 2 and 3 each succeeded on the FIRST Edit call using single-line oldStrings. Sarvam learned within the session.

## Diff quality

```diff
-            amount = int(float(amount_str))
+            amount = int(float(amount_str) * 100)

-        aggregated[month][category] = amount
+        aggregated[month][category] = aggregated[month].get(category, 0) + amount

-            lines.append(f"  {category}: {formatted_amount}")
+            lines.append(f"  {category}: ${formatted_amount}")
```

3 single-line changes. Textbook minimum viable.

## Run 06 → Run 07 comparison

| Metric | Run 06 (v2.3) | Run 07 (v2.4) |
|--------|---------------|---------------|
| All tests pass | 15/15 | 14/14 |
| Edit failures | 0 | 6 |
| test_runner used | N/A | Yes (all 4 runs) |
| ELEGANCE_CHECK file | Yes (blocked by hook) | No (correct inline) |
| memory_recall | N/A | Yes, first action |
| Test re-runs | 6+ | 4 (exact minimum) |
| Time | 3m44s | ~3m (estimated) |

## v2.5 fixes shipped

Based on these findings:

1. **Clause 25** (Edit tool discipline): "Use SMALLEST possible oldString — 1-3 lines max"
2. **Clause 26** (Compaction survival): "Call todo_list first, re-read files, run test_runner"
3. **Fuzzy Edit tool**: edit.ts upgraded with whitespace-normalized fallback matching
4. **Exercise 008**: 5-bug / 2-file / 20-test task designed to trigger compaction

---

*Run 07 validated the v2.4 thesis: memory + test_runner + ELEGANCE_CHECK defense all worked. The Edit spiral is the remaining gap, now addressed architecturally (fuzzy tool) and in-prompt (Clause 25).*
