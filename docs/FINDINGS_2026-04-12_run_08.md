# Run 08 Findings — Sarvam 105B × CME v2.5 × Exercise 008

**Date**: 2026-04-12 ~03:20 UTC
**Exercise**: 008 (todo-api debug, 5 bugs, 2 files, 20 tests)
**Agent**: codemath-swebench (CME v2.5, 26 clauses)
**Result**: 20/20 tests passing. All 5 bugs correctly fixed.
**Grade**: A+
**Time**: 2m59s

---

## Summary

Perfect run. Sarvam fixed 5 bugs across 2 files with zero Edit failures, correct cascade handling, and cross-file navigation. The v2.5 improvements (fuzzy Edit tool + Clause 25 small oldStrings) completely eliminated the whitespace spiral that plagued Run 07.

## Trajectory

| Run | Version | Bugs | Tests | Edit Fails | Time | Grade |
|-----|---------|------|-------|------------|------|-------|
| 06 | v2.3 | 3/3 | 15/15 | 0 | 3m44s | B+ |
| 07 | v2.4 | 3/3 | 14/14 | 6 | ~3m | A- |
| 08 | v2.5 | 5/5 | 20/20 | 0 | 2m59s | A+ |

## v2.5 improvements validated

1. **Clause 25 (small oldStrings)**: VALIDATED — zero Edit failures across 5 fixes
2. **Fuzzy Edit tool**: Available but likely not triggered (exact match probably worked since Sarvam used small oldStrings)
3. **Cascade handling**: VALIDATED — Bug 1 fixed first, 6 ERRORs resolved, remaining 4 bugs fixed
4. **Cross-file navigation**: VALIDATED — Bug 4 found in todo_helpers.py
5. **Memory protocol**: 11 memory_write calls with verification entries
6. **todo_add length limit**: Hit at 627 chars, correctly split into individuals — limit working as designed

## Clause 26 (compaction survival): UNTESTED

2m59s was too fast to trigger compaction. Need a 7+ bug exercise to extend the run.

## Bug fix quality

All 5 fixes are minimum viable single-line (or 2-line) edits:
- Bug 1: `new_id = 1` → `new_id = generate_id(todos)` (cascade root cause)
- Bug 2: Added `if t.get("completed", False): raise ValueError(...)` guard
- Bug 3: `t.get("priority") == priority` → `t.get("priority", "").lower() == priority.lower()`
- Bug 4: `"[ ]" if completed else "[X]"` → `"[X]" if completed else "[ ]"`
- Bug 5: `for t in todos` → `for t in active` in by_priority counting

## Minor deviations (acceptable)

- Bug 2 error message: "already completed" vs our "is already completed" — test uses assertIn, both pass
- Bug 3 approach: Sarvam used `.lower()` on both sides instead of calling validate_priority() — arguably more defensive

## Next: Exercise 009

Target compaction survival with 7 bugs / 3 files / 25 tests / regression trap.

---

*Run 08 is the cleanest run yet. The coaching loop (run → findings → prompt update → harder exercise) is producing measurable, monotonic improvement.*
