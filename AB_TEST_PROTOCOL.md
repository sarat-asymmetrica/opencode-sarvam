# A/B Test Protocol — CME v2.5 vs Vanilla across Models

## Thesis

The CodeMathEngine (CME) v2.5 mathematical scaffold improves coding quality
across ANY model, not just the one it was developed with (Sarvam 105B).

## Available Models (via AIMLAPI)

| Agent ID | Model | CME? | Notes |
|----------|-------|------|-------|
| `cme-grok` | Grok 4.1 Fast | Yes | Frontier reasoning model |
| `vanilla-grok` | Grok 4.1 Fast | No | Bare model, control group |
| `cme-deepseek` | DeepSeek R1 | Yes | Open-weight reasoning |
| `vanilla-deepseek` | DeepSeek R1 | No | Control |
| `cme-qwen` | Qwen 3 235B | Yes | Chinese frontier |
| `cme-llama` | Llama 4 Maverick | Yes | Meta open-weight |
| `cme-sarvam` | Sarvam 105B | Yes | Indian MoE (original) |
| `vanilla-sarvam` | Sarvam 105B | No | Control |

## Exercises (Bug Injection Baseline)

| Exercise | Bugs | Files | Tests | Failures | Difficulty |
|----------|------|-------|-------|----------|------------|
| 007 | 3 | 1 | 14 | 6 | Easy |
| 008 | 5 | 2 | 20 | 10 | Medium (cascading) |
| 009 | 7 | 3 | 28 | 10 | Hard (boundary pairs) |

## How to Run a Test

### 1. Reset the exercise
```bash
bash reset_exercise.sh 009
```

### 2. Switch agent in opencode
Change `default_agent` in opencode.json to the desired agent, e.g.:
```json
"default_agent": "cme-grok"
```
Or: `"default_agent": "vanilla-grok"`

### 3. Run opencode with the exercise prompt
```
Read the exercise spec at exercises/009-expense-tracker-debug.md. This is a 7-bug debugging
task across 3 files. 28 tests, 10 failures. Follow the workflow — use todo_add, memory_recall
first, test_runner (NOT bash), and write ELEGANCE_CHECK as inline text. Target: 28/28 passing.
```

For vanilla runs, use a simpler prompt (no CME-specific instructions):
```
There are 7 bugs in the expense-tracker codebase across 3 files. 28 tests, 10 failures.
Read the test file and source files, identify the bugs, fix them. Target: 28/28 passing.
```

### 4. Record results

| Field | Value |
|-------|-------|
| Agent | (e.g., cme-grok) |
| Exercise | (e.g., 009) |
| Model | (e.g., Grok 4.1 Fast) |
| CME? | Yes/No |
| Time | (seconds) |
| Bugs found | /7 |
| Bugs fixed | /7 |
| Tests passing | /28 |
| Edit failures | (count) |
| Tool calls | (count) |
| Memory used? | Yes/No |
| Todos used? | Yes/No |
| Notes | (observations) |

### 5. Reset and run the next agent

## What We're Measuring

1. **Accuracy**: Does CME improve bug-fix rate? (bugs fixed / total bugs)
2. **Efficiency**: Does CME reduce tool calls and edit failures?
3. **Discipline**: Does CME produce more structured reasoning? (todos, memory, test-once)
4. **Generalization**: Does CME help weaker models more than stronger ones?
5. **Overhead**: Does CME's prompt overhead slow down stronger models?

## Expected Findings

- CME should show biggest improvement on mid-tier models (Sarvam, Llama)
- Frontier models (Grok 4.1) may show smaller improvement (already strong)
- Vanilla agents should have more edit failures and test re-runs
- CME agents should show more structured output (todos, memory, ELEGANCE_CHECK)
