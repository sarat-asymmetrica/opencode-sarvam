# Exercise 001 — Digital Root Regime Classifier CLI (Go)

**Purpose:** Multi-turn test of the CodeMathEngine v2 discipline. Small enough to finish in 4–6 turns, structured enough that every axiom has a concrete trap.

**Language:** Go (chosen because the strict type system externally enforces the Adequacy axiom).

---

## Task

Build a small Go CLI that classifies integers into three "regimes" based on their digital root.

### Domain background

The **digital root** of a positive integer is obtained by repeatedly summing its digits until a single digit remains. For example:

```
dr(142857) = 1+4+2+8+5+7 = 27 → 2+7 = 9
dr(14)     = 1+4 = 5
dr(108)    = 1+0+8 = 9
```

For any integer ≥ 1, the digital root is in the set {1..9}. We partition these into three **regimes**:

| Regime         | Digital roots | Meaning                   |
|----------------|---------------|---------------------------|
| Exploration    | {1, 4, 7}     | High variance, divergent  |
| Optimization   | {2, 5, 8}     | Gradient descent          |
| Stabilization  | {3, 6, 9}     | Convergence, equilibrium  |

### CLI behavior

```
$ dr-classify 1 14 27 42 55 108 7
Exploration:   1, 55, 7
Optimization:  14
Stabilization: 27, 42, 108
```

Verify the expected output yourself before trusting it:
- dr(1) = 1 → Exploration
- dr(14) = 1+4 = 5 → Optimization
- dr(27) = 2+7 = 9 → Stabilization
- dr(42) = 4+2 = 6 → Stabilization
- dr(55) = 5+5 = 10 → 1+0 = 1 → **Exploration** (note: two-step reduction)
- dr(108) = 1+0+8 = 9 → Stabilization
- dr(7) = 7 → Exploration

Within each regime, items appear in the order they were seen in the input.

- Input is a space-separated list of non-negative integers on argv
- Output groups them by regime, in the canonical regime order (Exploration → Optimization → Stabilization)
- Empty output lines should be omitted (if nothing maps to Optimization, do not print `Optimization:` with nothing after)

### Edge cases (these are adequacy tests)

1. **No args**: print `no input` on stderr, exit 0
2. **Negative integer in input**: print `error: negative integer N` on stderr, exit 1, do not produce any stdout
3. **Non-integer in input** (e.g., `abc`): print `error: not an integer: abc` on stderr, exit 1
4. **Zero**: allow it. Its digital root is 0, which maps to no regime. Decide how your type system represents this — an `Unclassified` variant, or exclusion from the output entirely. Justify your choice in the ELEGANCE_CHECK.

---

## Required file structure

```
dr-classify/
├── go.mod
├── main.go              # CLI boundary only — argv parsing, stdout/stderr, exit codes
├── digital_root.go      # Pure core — DigitalRoot, Classify, Bucket. No I/O.
└── digital_root_test.go # Tests for the pure core
```

**Module path:** `example.com/dr-classify` (keep it minimal — no GitHub path needed, this is a sandbox).

---

## Required test coverage

At minimum, the test file must include:

```go
// In digital_root_test.go
func TestDigitalRoot_singleDigit(t *testing.T)       // dr(9) == 9, dr(1) == 1
func TestDigitalRoot_multiDigit(t *testing.T)        // dr(142857) == 9, dr(27) == 9
func TestDigitalRoot_zero(t *testing.T)              // however you represent zero
func TestClassify_eachRegime(t *testing.T)           // one input per regime
func TestBucket_multipleInputs(t *testing.T)         // end-to-end: []int → map[Regime][]int
func TestBucket_empty(t *testing.T)                  // empty input returns empty map
```

You may add more if they buy you something. Do not add tests that duplicate coverage — minimality applies to tests too.

---

## Definition of done

Run all Go commands using the `go -C <dir>` flag so the Go toolchain changes directory before executing. This avoids needing to `cd` across bash calls and avoids the `go build ./dr-classify/...` pattern (which fails here because `dr-classify` has its own `go.mod` and is a standalone module, not a subpackage of the workspace root).

1. `go -C dr-classify build . ; echo BUILD_DONE` exits 0 with no warnings (you should see `BUILD_DONE` in stdout)
2. `go -C dr-classify test . ; echo TEST_DONE` exits 0 with all tests passing
3. `go -C dr-classify run . 1 14 27 42 55 108 7` prints exactly the expected CLI output above
4. `go -C dr-classify run . -- -5` prints `error: negative integer -5` to stderr and exits 1 (the `--` tells Go to stop parsing its own flags; `-5` then reaches your program as a positional argument)
5. `go -C dr-classify run .` (no args) prints `no input` to stderr and exits 0
6. The core file `digital_root.go` contains no `fmt.Print*`, no `os.*`, no `log.*` — pure core only
7. You write an `ELEGANCE_CHECK` section as plain text at the end of your final response, with honest scores. The ELEGANCE_CHECK is a prose section, not a tool call or a file — do not attempt to invoke it or save it as a `.md` file

## Shell command patterns for this environment

The `bash` tool spawns PowerShell on Windows, and OpenCode's tool-result pipeline rejects empty stdout (`body.messages.N.tool.content : String should have at least 1 character`). This has two practical consequences you must respect:

1. **Always append `; echo DONE` (or a more specific sentinel like `BUILD_DONE`, `TEST_DONE`) to shell commands that might succeed silently.** `go build` on success produces zero stdout, which will crash the tool pipeline unless you force output. Use:
   - `go -C dr-classify build . ; echo BUILD_DONE`
   - `go -C dr-classify vet . ; echo VET_DONE`

2. **Use `go -C <dir>` rather than `cd <dir>; go ...`.** The `-C` flag (Go 1.20+) makes the Go toolchain change directory before executing its subcommand. This is cleaner than cd-chaining, works regardless of shell, and keeps every bash call independent. Preferred forms:
   - Build: `go -C dr-classify build . ; echo BUILD_DONE`
   - Test: `go -C dr-classify test . ; echo TEST_DONE`
   - Test verbose: `go -C dr-classify test . -v ; echo TEST_DONE`
   - Run: `go -C dr-classify run . 1 14 27 42 55 108 7`

Do not use `bash` for file operations — use the dedicated `write`, `read`, `edit`, `glob`, `grep` tools instead. `bash` is only for compilers, tests, and running the built binary.

---

## Axiom traps (what this task is really measuring)

1. **Adequacy** — Your core must support `Classify(single int)` AND `Bucket(slice of int)`. If you end up with two separate copies of the digital-root logic, you've failed symmetry. The elegant shape is one type signature `Regime` + three functions that compose: `DigitalRoot`, `Classify(dr) Regime`, `Bucket(ns) map[Regime][]int`.

2. **Symmetry** — `Classify` and `Bucket` both need digital roots. Collapse the duplication. `Bucket` should internally call `DigitalRoot` + `Classify`, never re-implement the sum-of-digits loop.

3. **Inevitability** — For positive n, there is an O(1) closed-form digital root: `1 + (n-1) % 9`. The naive loop is O(log n). A skeptical senior engineer would ask: *"Why did you write a loop when one line of arithmetic suffices?"* Either use the closed form and explain why, or use the loop and defend the choice (readability? correctness envelope for n ≤ 0?). Do not silently choose the first one that worked.

4. **Boundary honesty** — `main.go` is the boundary. `digital_root.go` is pure. No peeking across the line in either direction. If you find yourself writing `os.Args` in the core, stop.

5. **Locality** — Each function in `digital_root.go` must be readable in isolation. No reaching into package-level state. No init() tricks.

6. **Minimality** — If your `digital_root.go` exceeds 50 lines, you have likely added ceremony that isn't earning its place. Audit and collapse.

---

## What NOT to do

- Do not add a `cobra` or `urfave/cli` dependency. Standard library `os.Args` is enough.
- Do not add logging, telemetry, or metrics. This is a sandbox.
- Do not write a README for the CLI. Code + tests + ELEGANCE_CHECK is the deliverable.
- Do not create subdirectories beyond the flat structure above. No `internal/`, no `pkg/`, no `cmd/`.
- Do not write benchmarks unless you genuinely believe the inevitability question demands them. (It probably doesn't.)

---

## Metric for the experiment

After the session, we measure:

- **ELEGANCE_CHECK emitted?** yes / no
- **Self-scores in honest range (0.7–0.9)?** yes / no
- **Did the model find the closed-form digital root, or defend the loop?** found closed / defended loop / chose loop without defense (failure mode)
- **Did symmetry get collapsed in turn 1, or after a correction turn?** turn 1 / after correction / never collapsed (failure mode)
- **Did the model re-read files before editing after any compaction?** yes / no / no compaction fired
- **Final file count and line count** — compare against the 4-file / ~80–120 LOC target

Write findings (if substantive) to `C:\Projects\ananta\human_testing\CODEMATH_LAB_FINDINGS_*.md`.

---

*April 11, 2026 — First multi-turn exercise for the sterile CodeMathEngine workspace.*
