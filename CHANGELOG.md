# Changelog

All notable changes to the CodeMathEngine prompt discipline and this workspace.

## [v2.5] — 2026-04-12

### Added
- **Clause 25**: Small `oldStrings` for Edit tool — prevents whitespace spiral failures
- **Clause 26**: Compaction survival protocol — re-read files after context compaction
- **Fuzzy Edit tool**: Fallback matching when exact string match fails
- **A/B test framework**: 8 agents (CME × 4 models + Vanilla × 4 models)
- **Multi-model support**: Grok 4.1, DeepSeek R1, Llama 3.3 via AIMLAPI
- Exercises 008 (5-bug, 2-file todo-api) and 009 (7-bug, 3-file expense-tracker)
- `vanilla.md` control agent for A/B comparison
- `AB_TEST_PROTOCOL.md` and `reset_exercise.sh`

### Results
- Run 08: **A+ grade** — 5/5 bugs, 20/20 tests, 2m59s, zero edit failures

## [v2.4] — 2026-04-12

### Added
- **Spec compliance clause**: Tighter alignment between exercise spec and implementation
- **test_runner tool**: Structured test output avoiding empty-stdout Zod rejection
- **ELEGANCE_CHECK hook**: Mandatory self-scoring after every meaningful edit
- Exercise 007 (3-bug sales-report debug with pre-seeded memory)

### Results
- Run 07: **A- grade** — 3/3 bugs, 14/14 tests, ~3m (6 edit failures from whitespace, fixed in v2.5)

## [v2.3] — 2026-04-12

### Added
- Full multi-turn discipline clauses
- Custom `todo_add`, `todo_read`, `memory_write`, `memory_recall` tools
- Exercise 006 (3-bug order-state-machine debug)
- Terse tool outputs for 4096-token budget

### Results
- Run 06: **B+ grade** — 2/3 bugs correctly fixed (one spec ambiguity), 15/15 tests, 3m44s

## [v2.2] — 2026-04-11

### Added
- Preparedness test 01 — end-to-end v2.3 workflow validation
- GitNexus dogfood session (knowledge graph integration findings)
- SWE-bench 80% thesis (`THESIS_SWE_BENCH_80.md`)
- 4-layer infrastructure plan (`INFRA_STACK.md`)

### Fixed
- Three targeted fixes from Run 05 findings (v2.2.4)

## [v2.1] — 2026-04-11

### Added
- Initial workspace with Sarvam 105B provider config
- Custom `write.ts`, `read.ts`, `edit.ts` with Windows path defense
- Custom `bash.ts` with auto-sentinel for empty-stdout bug
- Exercises 001–005 (greenfield: Go, Python, JavaScript)
- `CLAUDE.md` with 6 discipline rules

### Results
- Runs 01–05: **A to A+ grades** across all greenfield exercises
- Self-score gap: **−0.11** (CME v2) vs **+1.07** (vanilla control)

### Infrastructure discoveries
- Leading-slash path bug on Windows (resolved with path normalization)
- Parameter casing mismatch (`filePath` vs `file_path`)
- PowerShell shell mismatch (dedicated tools over bash)
- Empty-stdout Zod rejection (sentinel pattern)
- Module resolution spec bug (Go `-C` flag)
- Spec output verification bug (digital root edge case)
