# opencode-sarvam

**A mathematically-principled prompt discipline for agentic coding — tested across frontier and open-weight models.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## What is this?

This repository contains **CodeMathEngine (CME) v2.5** — a 26-clause prompt discipline that makes language models produce more rigorous, self-correcting code in multi-turn agentic sessions. It runs inside [OpenCode](https://opencode.ai), an open-source AI coding agent.

The core idea: instead of relying on persona tricks or chain-of-thought hacks, CME treats code generation as a **mathematical discipline** — with axioms for boundary honesty, locality preservation, cost-bounded complexity, and adversarial self-critique. Every meaningful edit ends with an `ELEGANCE_CHECK`: a multiplicative self-score that penalizes inflation and rewards honest calibration.

**This is not a chatbot personality. It's a verifiable coding methodology.**

## Why it matters

Most agentic coding prompts degrade over long sessions. Context compaction loses instructions, self-scores inflate, and the model forgets its own invariants by turn 40. CME v2.5 is designed to survive this:

- **26 clauses** covering boundary honesty, inevitability, locality, cost, adequacy, and compaction survival
- **Multiplicative self-scoring** — a single weak dimension tanks the score, preventing inflation
- **Model-agnostic** — tested on 4 different models without modification
- **Empirically validated** — 8 runs with documented findings, monotonic improvement trajectory

## Results

8 experimental runs across greenfield and debugging tasks, all using CME v2.5 on [OpenCode](https://opencode.ai):

| Run | Exercise | Type | Language | Bugs | Tests | Time | Grade |
|-----|----------|------|----------|------|-------|------|-------|
| 01 | Digital Root Classifier | Greenfield | Go | — | 7/7 | ~56s | A |
| 02 | LRU Cache | Greenfield | Python | — | 14/14 | ~45s | A+ |
| 03 | Order State Machine | Greenfield | Python | — | 15/15 | ~50s | A |
| 04 | CSV Parser | Greenfield | JavaScript | — | 24/24 | ~40s | A |
| 05 | Sales Report Refactor | Refactor | Python | — | 14/14 | ~55s | A+ |
| 06 | State Machine Debug | Debug (3 bugs) | Python | 2/3 | 15/15 | 3m44s | B+ |
| 07 | Sales Report Debug | Debug (3 bugs) | Python | 3/3 | 14/14 | ~3m | A- |
| 08 | Todo API Debug | Debug (5 bugs, 2 files) | Python | 5/5 | 20/20 | 2m59s | A+ |

**Key finding**: The coaching loop — run exercise → document findings → update prompt → harder exercise — produces monotonic improvement. Run 08 (5 bugs, 2 files) was solved perfectly in under 3 minutes with zero edit failures.

### Calibration quality

One of CME's most important properties is **honest self-scoring**. In A/B testing:

| Agent | Self-Score Gap | Interpretation |
|-------|---------------|----------------|
| CME v2 (multiplicative) | **−0.11** | Slightly underestimates — ideal calibration |
| Vanilla control (additive) | **+1.07** | Significantly overestimates — inflated scoring |

A negative gap means the model grades itself *harder* than the external grader does. That's exactly what you want in an autonomous agent.

## Models tested

CME v2.5 is model-agnostic. The same 26-clause prompt runs unmodified on:

| Model | Parameters | Context | Provider |
|-------|-----------|---------|----------|
| **Sarvam 105B** | 105B MoE | 128K | [Sarvam AI](https://sarvam.ai) (free inference) |
| **Grok 4.1 Fast** | — | 131K | [xAI](https://x.ai) via AIMLAPI |
| **DeepSeek R1** | 671B MoE | 128K | [DeepSeek](https://deepseek.com) via AIMLAPI |
| **Llama 3.3 70B** | 70B | 131K | [Meta](https://llama.meta.com) via AIMLAPI |

Each model is tested in two configurations: **CME** (with the 26-clause discipline) and **Vanilla** (bare model, no scaffold), enabling controlled A/B comparison.

## Quick start

### Prerequisites

- [OpenCode](https://opencode.ai) installed
- At least one API key (see [Providers](#providers) below)

### Run an exercise

```bash
git clone https://github.com/sarat-asymmetrica/opencode-sarvam.git
cd opencode-sarvam

# Set your API key(s)
export SARVAM_API_KEY="your-key-here"      # Sarvam AI (free)
export AIMLAPI_KEY="your-key-here"          # AIMLAPI (Grok/DeepSeek/Llama)

# Launch OpenCode
opencode

# Inside OpenCode, run an exercise:
# /ab-test cme-sarvam exercises/001-dr-classify.md
```

### Reset an exercise to its baseline

```bash
./reset_exercise.sh todo-api
```

## Repository structure

```
opencode-sarvam/
├── opencode.json                   # 8 agents × 4 models, provider config
├── CLAUDE.md                       # Agent instructions (loaded by OpenCode)
├── README.md                       # You are here
├── LICENSE                         # MIT
│
├── .opencode/
│   ├── agents/
│   │   ├── codemath-lead-swebench.md   # CME v2.5 (26 clauses)
│   │   └── vanilla.md                  # Control baseline (no discipline)
│   ├── commands/
│   │   ├── ab-test.md              # A/B test orchestration
│   │   └── test.md                 # Test runner
│   └── tools/                      # Custom tools (Windows-hardened)
│       ├── write.ts, read.ts, edit.ts  # File ops with path defense
│       ├── bash.ts                 # Shell with auto-sentinel
│       ├── test_runner.ts          # Structured test output
│       └── todo*.ts, memory*.ts    # Long-horizon state management
│
├── exercises/                      # 9 coding exercises (difficulty gradient)
│   ├── 001-dr-classify.md          # Go CLI — digital root classification
│   ├── 002-lru-cache-python.md     # Python — data structure + tests
│   ├── 003-order-state-machine-python.md  # Python — state machine
│   ├── 004-csv-parser-javascript.md       # JavaScript — parser + edge cases
│   ├── 005-refactor-sales-report-python.md # Python — refactoring
│   ├── 006-order-state-machine-debug.md   # Debug: 3 bugs, 1 file
│   ├── 007-sales-report-debug.md          # Debug: 3 bugs, pre-seeded memory
│   ├── 008-todo-api-debug.md              # Debug: 5 bugs, 2 files
│   └── 009-expense-tracker-debug.md       # Debug: 7 bugs, 3 files (stress)
│
├── docs/                           # Detailed findings from each run
│   ├── FINDINGS_2026-04-11_run_01-05.md
│   ├── FINDINGS_2026-04-12_run_06-08.md
│   └── ...                         # 12 findings documents total
│
├── dr-classify/                    # Exercise workspaces (agent writes here)
├── lru-cache/
├── order-state-machine/
├── csv-parser/
├── sales-report/
├── todo-api/
├── expense-tracker/
│
├── THESIS_SWE_BENCH_80.md          # North star: 80%+ SWE-bench Verified
├── INFRA_STACK.md                  # 4-layer integration architecture
├── math_layer_design.md            # 6 mathematical contributions
├── AB_TEST_PROTOCOL.md             # A/B testing methodology
└── AGENT_HARNESS_BEST_PRACTICES.md # Lessons from running agents on Windows
```

## The 26 clauses (summary)

The full prompt is in [`.opencode/agents/codemath-lead-swebench.md`](.opencode/agents/codemath-lead-swebench.md). Here's the gist:

| # | Clause | Purpose |
|---|--------|---------|
| 1-5 | **Boundary, Inevitability, Locality, Cost, Adequacy** | Core mathematical axioms — code must be honest about its domain, deterministic where possible, locally coherent, cost-bounded, and type-adequate |
| 6-10 | **Adversarial self-critique, ELEGANCE_CHECK, Multiplicative scoring** | Every edit gets a self-score; one weak axis tanks the total; inflation is structurally prevented |
| 11-15 | **Tool discipline, Path conventions, Shell safety** | Platform-specific hardening (Windows path traps, empty-stdout bugs, parameter casing) |
| 16-20 | **Memory protocol, Todo management, Test discipline** | Externalize state for long-horizon runs; run tests once per fix, not repeatedly |
| 21-26 | **Edit strategy, Compaction survival, Cascade handling** | Use small `oldStrings` for edits; after compaction, re-read files; fix root-cause bugs first |

## Providers

### Sarvam AI (recommended for getting started)

[Sarvam AI](https://sarvam.ai) offers **free inference** for their 105B MoE model — no credit card required. Sign up, get an API key, and set:

```bash
export SARVAM_API_KEY="sk_..."
```

> **Note**: Sarvam uses `api-subscription-key` as the auth header (not `Authorization: Bearer`). This is already handled in `opencode.json`.

### AIMLAPI (multi-model access)

[AIMLAPI](https://aimlapi.com) provides unified access to Grok, DeepSeek, Llama, and other models:

```bash
export AIMLAPI_KEY="..."
```

## Research direction

This workspace feeds a larger thesis documented in [`THESIS_SWE_BENCH_80.md`](THESIS_SWE_BENCH_80.md):

> Can an open-weight model, driven by mathematically-principled agentic scaffolding, achieve competitive scores on [SWE-bench Verified](https://www.swebench.com/) — the gold standard for agentic coding evaluation?

The 4-layer integration plan ([`INFRA_STACK.md`](INFRA_STACK.md)) combines:
1. **Memory layer** — persistent state across sessions ([Memori](https://github.com/nichochar/memori))
2. **Wiki layer** — semantic codebase understanding ([CodeWiki](https://github.com/nichochar/codewiki))
3. **Graph layer** — structural code intelligence ([GitNexus](https://github.com/nichochar/gitnexus))
4. **Evaluation harness** — reproducible benchmarking ([SWE-bench](https://github.com/princeton-nlp/SWE-bench))

## Adding your own exercises

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide. The short version:

1. Create `exercises/NNN-your-exercise.md` following the existing format
2. If it's a debug exercise, create the buggy workspace (e.g., `your-exercise/`)
3. Run it with CME and Vanilla agents for comparison
4. Document findings in `docs/FINDINGS_DATE_run_NN.md`

## License

[MIT](LICENSE) — do whatever you want with it.

## Acknowledgments

- [OpenCode](https://opencode.ai) — the agentic coding harness this runs on
- [Sarvam AI](https://sarvam.ai) — free 105B inference that makes this research accessible
- [AIMLAPI](https://aimlapi.com) — unified multi-model API access
- [SWE-bench](https://www.swebench.com/) — the benchmark driving the larger research direction

---

*Built with curiosity and mathematical discipline. Sarve jana sukhino bhavantu — may all beings benefit.* 🙏
