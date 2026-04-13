# Contributing to opencode-sarvam

Thank you for your interest in contributing! This is an active research project testing mathematically-principled prompt disciplines for agentic coding. Contributions of all kinds are welcome — new exercises, findings documentation, prompt improvements, and infrastructure fixes.

## Ways to contribute

### 1. Add a new exercise

Exercises are the core experimental unit. Each one tests a specific skill (greenfield, debugging, refactoring) at a specific difficulty level.

**To create an exercise:**

1. Pick a number: exercises are numbered sequentially (`001`, `002`, ...). Use the next available number.
2. Create `exercises/NNN-your-exercise.md` with this structure:

```markdown
# Exercise NNN — [Title]

**Type:** Greenfield | Debug | Refactor
**Language:** Python | Go | JavaScript | TypeScript
**Difficulty:** Beginner | Intermediate | Advanced
**Bugs (if debug):** N bugs across M files
**Tests:** N tests

## Context
[Brief description of what the exercise tests]

## Task
[What the agent should build or fix]

## Spec
[Detailed specification — inputs, outputs, edge cases]

## Tests
[Test file location and how to run them]

## Success criteria
[What "done" looks like — all tests pass, specific behaviors verified]
```

3. If it's a debug exercise, create the buggy workspace directory (e.g., `your-exercise/`) with intentionally broken code and a passing test suite that exposes the bugs.

4. Run the exercise with at least two agents (e.g., `cme-sarvam` and `vanilla-sarvam`) to generate comparison data.

### 2. Document findings

Every run should produce a findings document. These are the empirical backbone of the project.

**Create `docs/FINDINGS_YYYY-MM-DD_run_NN.md` with:**

- Model, agent version, exercise name
- Timeline of what happened (bugs found, edit failures, compaction events)
- Final result (tests passing, grade, time)
- What worked and what didn't
- Specific clause improvements suggested by the run

### 3. Improve the CME prompt

The prompt lives in `.opencode/agents/codemath-lead-swebench.md`. It evolves through a coaching loop:

1. Run an exercise and document the findings
2. Identify specific failure modes (e.g., "edit tool used too-large oldStrings and failed")
3. Add or modify a clause to address the failure
4. Run a harder exercise to validate the fix didn't regress anything

**Please do NOT:**
- Rewrite the prompt from scratch — it has 8 runs of empirical validation behind it
- Add clauses without a documented failure mode that motivates them
- Remove clauses without evidence they're no longer needed

### 4. Add a new model

The A/B framework supports any OpenAI-compatible model. To add one:

1. Add the provider and model to `opencode.json`
2. Create both a `cme-yourmodel` and `vanilla-yourmodel` agent entry
3. Run at least exercises 001 and 008 to establish baseline performance
4. Document the results

### 5. Fix infrastructure issues

The custom tools in `.opencode/tools/` handle platform-specific edge cases (Windows path normalization, empty-stdout bugs, parameter casing). If you find a new edge case, fix the tool and document it in `AGENT_HARNESS_BEST_PRACTICES.md`.

## Development setup

### Prerequisites

- [OpenCode](https://opencode.ai) installed
- Node.js 18+ (for OpenCode plugins)
- Python 3.10+ (for Python exercises)
- Go 1.21+ (for Go exercises)
- At least one API key (Sarvam AI is free)

### Running locally

```bash
git clone https://github.com/sarat-asymmetrica/opencode-sarvam.git
cd opencode-sarvam
npm install

# Set API key(s)
export SARVAM_API_KEY="your-key"

# Launch
opencode
```

### Running an A/B test

```bash
# Inside OpenCode:
/ab-test cme-sarvam exercises/008-todo-api-debug.md
# Then switch agent and repeat:
/ab-test vanilla-sarvam exercises/008-todo-api-debug.md
```

See [`AB_TEST_PROTOCOL.md`](AB_TEST_PROTOCOL.md) for the full methodology.

## Code style

- **Findings docs**: Honest and detailed. Include failures. "B+" is fine — inflated grades defeat the purpose.
- **Exercises**: Self-contained. A contributor should be able to run any exercise without needing context from other exercises.
- **Prompt clauses**: Each clause should have a one-line summary, a motivation (what failure mode it prevents), and concrete guidance.
- **Custom tools**: Defensive. Assume the model will emit Unix paths on Windows, wrong parameter casing, and empty-stdout commands.

## Commit style

This project uses conventional commits:

```
feat(exercise): 008 — todo-api debug with 5 bugs across 2 files
feat(prompt): CME v2.5 — Clause 25 small oldStrings + fuzzy Edit
fix(tools): terse tool outputs for 4096-token budget
docs: Run 08 findings — A+ grade, 2m59s, zero edit failures
```

## Questions?

Open an issue or start a discussion. This is an active research project — we're learning as we go, and good questions are as valuable as good code.
