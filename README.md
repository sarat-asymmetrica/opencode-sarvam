# opencode-sarvam

Minimal OpenCode workspace driving **Sarvam 105B** under the **CodeMathEngine v2** discipline, for long-horizon multi-turn code generation experiments.

Single-turn validation was done in `C:/Projects/ananta/human_testing/codemath_lab.mjs` on April 11, 2026. This workspace extends that validation to multi-turn tool-use sessions.

## Quick start

```bash
export SARVAM_API_KEY="sk_ro2wts6u_..."
cd C:/Projects/opencode-sarvam
opencode
```

If OpenCode isn't installed, see https://opencode.ai.

## Structure

```
opencode-sarvam/
├── opencode.json               # Minimal config: Sarvam provider + one agent
├── CLAUDE.md                   # Project instructions, loaded automatically by OpenCode
├── README.md                   # This file
└── .opencode/
    └── agents/
        └── codemath-lead.md    # The v2 Pragmatic + Adequacy + multi-turn prompt
```

One provider. One model. One agent. One CLAUDE.md. No skills, no commands, no subagents, no persona. The minimum necessary to drive the experiment.

## The research question

> Does the CodeMathEngine v2 prompt discipline (Boundary + Inevitability + Locality + Cost + Adversarial self-critique + multiplicative elegance formula + Adequacy axiom) survive when the model has to carry it across 20-80 turns under compaction pressure?

Single-turn, we measured:
- v2 Pragmatic's self-score gap: **-0.11** (underestimates itself slightly — exactly what calibration-beats-confidence predicts)
- v5 Control's self-score gap: **+1.07** (unbounded self-scoring from additive formula)
- v3 + Adequacy's gap: **-0.05** (near-perfect calibration)
- v2's code was graded **higher** than v5's on identical test suites

Multi-turn is where the ritual either holds or drifts. That's what this workspace is for.

## Known risks

See `CLAUDE.md` §"Known risks & things to watch for" for the full list. Headline items:

1. **Sarvam's `reasoning_content` field** may not be merged into `content` by OpenCode's openai-compatible provider. We hit this exact bug in the lab this afternoon. If responses come back empty, this is why.
2. **`api-subscription-key` header** is non-standard (vs `Authorization: Bearer`). Provider config injects it via `options.headers` — may need a wrapper if the SDK drops custom headers.
3. **128K context is tight.** Compaction will fire more aggressively than in GPT-5.4-based workspaces. The experiment is partly about whether the ritual survives compaction, so this is a feature, not a bug.

## What to do after a session

1. Note any ELEGANCE_CHECK blocks the model emitted. Did self-scores stay honest?
2. Note any turns where the model forgot to self-score after a substantial edit.
3. Note any "drift" — did the model violate an earlier-established invariant without noticing?
4. Note any compaction events and whether the ritual survived them.
5. If the session produced a substantive finding, write it to `C:/Projects/ananta/human_testing/CODEMATH_LAB_FINDINGS_*.md` with date stamp.

## Non-goals

- This is not a production workspace.
- This is not Ananta.
- This is not Pocket Alchemy.
- This is not a persona experiment — the agent has no warmth, no name beyond CodeMathEngine, no cheerfulness. That's by design.

The workspace can be deleted at any time without affecting anything else.
