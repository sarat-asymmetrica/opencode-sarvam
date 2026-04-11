# Exercise 004 — CSV Parser (JavaScript / Node.js)

**Purpose:** Test CodeMathEngine v2.2.2 discipline in a **new language ecosystem** (Node.js + JavaScript ESM) with a **new test runner** (`node:test` from the standard library) on a task that has a deceptively nuanced problem shape (CSV parsing is harder than it looks).

**What's deliberately different from Exercises 001–003:**
- **Language:** JavaScript (Node.js ESM), not Python or Go. First JavaScript task in this workspace.
- **Test runner:** Node.js built-in `node:test` module (Node 18+), not pytest, not `go test`, not Python `unittest`. Different assertion API, different discovery mechanics, different output format.
- **No compilation step:** Pure interpreted JavaScript, no `tsc`, no bundler, no TypeScript. This is the simplest possible Node setup.
- **Algorithmic depth:** CSV parsing looks like a three-line `split(",")` problem at first glance. The elegant solution is internally a small state machine (which is a deliberate callback to Exercise 003) — but in a fresh language, with no external libraries. **Does Sarvam reach for a state machine when the simpler `split` would be wrong?**

**Environment:** Node.js 18+ (should be available as `node` on PATH). No `package.json`, no `node_modules`, no external dependencies. Pure stdlib.

---

## Task

Implement a **CSV parser** as a single pure function that takes a CSV-formatted string and returns an array of rows, where each row is an array of cell strings.

### Domain specification

The parser must correctly handle the subset of RFC 4180 defined below:

1. **Basic cells** separated by commas:
   ```
   a,b,c        →  [["a", "b", "c"]]
   ```

2. **Multiple rows** separated by newlines (`\n`):
   ```
   a,b,c\nd,e,f  →  [["a", "b", "c"], ["d", "e", "f"]]
   ```

3. **Quoted cells** containing commas:
   ```
   a,"b,c",d    →  [["a", "b,c", "d"]]
   ```

4. **Quoted cells** containing newlines:
   ```
   a,"b\nc",d   →  [["a", "b\nc", "d"]]
   ```

5. **Escaped quotes** inside quoted cells (RFC 4180: two consecutive quotes represent one literal quote):
   ```
   a,"he said ""hi""",b  →  [["a", 'he said "hi"', "b"]]
   ```

6. **Empty cells**:
   ```
   a,,b         →  [["a", "", "b"]]
   ```

7. **Empty rows** (consecutive newlines) are skipped entirely (do not produce an empty row in the output):
   ```
   a,b\n\nc,d   →  [["a", "b"], ["c", "d"]]
   ```

8. **Trailing newline** at end of input is ignored:
   ```
   a,b\n        →  [["a", "b"]]
   ```

### Required function signature

```javascript
// csv_parser.mjs
export function parse(csvText) {
    // Returns: Array<Array<string>>
    // Throws: Error if input is malformed (unclosed quoted cell)
}
```

**That is the entire API.** No `parseRow`, no `parseHeader`, no options object. One function, one input, one output, one error type.

### Edge cases that MUST be handled

- Empty input string → returns `[]` (empty array of rows)
- Single cell, no commas → returns `[["cell"]]`
- Unclosed quoted cell (e.g., `a,"unclosed,b`) → throws `Error` with a clear message naming the problem
- Quoted cell containing only a quote (i.e., empty quoted cell with escaped quote: `""""`) → that is ONE cell containing ONE `"` character
- Cell with only whitespace → preserved as-is (do not trim)

---

## Required file structure (flat)

```
csv-parser/
├── csv_parser.mjs         # The parse() function, pure, no I/O
└── csv_parser.test.mjs    # node:test based tests
```

**`.mjs` extensions** — this tells Node to treat the files as ES modules without needing a `package.json`. No `import type`, no `require`, no CommonJS.

---

## Required tests (use `node:test`, not Jest, not Mocha)

Use Node's built-in test runner. Import from `node:test` and `node:assert/strict`. The file structure:

```javascript
// csv_parser.test.mjs
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { parse } from './csv_parser.mjs';

test('parses simple unquoted row', () => {
    assert.deepEqual(parse('a,b,c'), [['a', 'b', 'c']]);
});

test('parses multiple rows', () => {
    // ...
});

// ... etc
```

At minimum, include these tests:

- `parses simple unquoted row`
- `parses multiple rows separated by newline`
- `parses quoted cell containing comma`
- `parses quoted cell containing newline`
- `parses escaped quote inside quoted cell`
- `parses empty cells`
- `skips empty rows`
- `ignores trailing newline`
- `returns empty array for empty input`
- `throws on unclosed quoted cell`

**Do NOT add:**
- A test that only checks `parse` is a function (trivial, type-level)
- A test that duplicates the demo command's assertion (minimality — see clause 14)
- Multiple tests that differ only in cosmetic detail

---

## Definition of done

1. `node --test csv-parser/csv_parser.test.mjs ; echo TEST_DONE` exits 0 with all tests passing (Node's `--test` flag runs the test runner; the sentinel is still required because passing tests can have terse output)
2. **Demo**: `node -e "import('./csv-parser/csv_parser.mjs').then(m => console.log(JSON.stringify(m.parse('name,age\nAlice,30\n\"Bob, Jr\",25'))))" ; echo DEMO_DONE` prints exactly:
   ```
   [["name","age"],["Alice","30"],["Bob, Jr","25"]]
   DEMO_DONE
   ```
3. `csv_parser.mjs` contains no `console.log`, no `process.stdout`, no `fs.*`, no `require` — pure function, no I/O
4. `csv_parser.mjs` under **60 lines total** (imports, function body, export statement, blank lines, comments)
5. `csv_parser.test.mjs` under **90 lines total**
6. You write an `### ELEGANCE_CHECK — csv-parser` section as plain text at the end of your final response, with all seven axiom fields filled in and an honest Strongest Objection. **Reproduce the header EXACTLY** including the `###` and the em-dash.

---

## Axiom traps (what this exercise is really measuring)

**Trap 1 — Inevitability.** The naive answer is `csvText.split('\n').map(row => row.split(','))`. This handles case 1 correctly and every other case wrongly. The elegant answer is a small **character-by-character state machine** with states like `IN_CELL_UNQUOTED`, `IN_CELL_QUOTED`, `MAYBE_ESCAPE_QUOTE`. **Does Sarvam reach for the state machine, or does it try to patch `split` with regex workarounds?** A regex-based solution is possible but harder to get right than a state machine; watch which direction Sarvam goes.

**Trap 2 — Boundary honesty in a new language.** JavaScript makes it easy to sprinkle `console.log` everywhere for debugging. The pure-core rule is strict: `csv_parser.mjs` must have zero I/O. **Does any debug print leak in and survive to the final version?**

**Trap 3 — Test minimality under a new test runner (v2.2.2 clause 14).** `node:test` has a very low ceremony overhead, which makes it tempting to add one test per edge case "just to be safe". The spec lists 10 required tests as the minimum; adding an 11th because it "might buy something" is exactly the failure mode clause 14 was written to prevent. **Does the test file stay near the 10-test minimum, or bloat to 15+?**

**Trap 4 — Cross-reference fidelity (v2.2.2 clause 13).** The spec references Node's `node:test` and `node:assert/strict` modules explicitly. These are stdlib but not universally known — Sarvam may try to use `assert.equal` (loose) when the spec implicitly requires `assert.deepEqual` (for comparing arrays). **Does Sarvam read the assertion library docs before writing tests, or does it guess the API?**

**Trap 5 — ELEGANCE_CHECK format fidelity (v2.2.2 closing ritual).** The v2.2.1 patch said to use `### ELEGANCE_CHECK — <identifier>`; Run 03 dropped the `###`. v2.2.2 made this more explicit. **Does Sarvam reproduce the exact literal format this time, including the `###` prefix?**

---

## What NOT to do

- Do not add external dependencies (`npm install papaparse`, `csv-parse`, etc.). Standard library only — `node:test` and `node:assert/strict` are the entire test infrastructure.
- Do not create `package.json`, `node_modules`, `package-lock.json`, or `.nvmrc`. The `.mjs` extension is sufficient for ESM detection.
- Do not create subdirectories beyond `csv-parser/` itself.
- Do not use TypeScript or `tsc`. Plain JavaScript only. Type annotations via JSDoc comments are fine if concise.
- Do not implement CSV *writing*. This exercise is parse-only.
- Do not handle CSV dialects with different delimiters (`;`, tab). Only comma-delimited.
- Do not add options for "skip header row", "first row is headers", or similar. The caller handles interpretation; the parser just returns rows.

---

## Note to the orchestrator (read after the run)

This is the first JavaScript exercise in the opencode-sarvam workspace. Watch for:

1. Environment issues — does `node` resolve on the first call?
2. `.mjs` vs `.js` confusion — does Sarvam know ESM conventions without a package.json?
3. `node:test` output format — will the empty-stdout bug fire if `node --test` produces minimal output on success?
4. State-machine discovery — does Sarvam reach for the elegant approach or try regex workarounds?
5. Clause 14 (new test minimality) — does the test file stay at 10 tests?
6. Clause 13 (cross-reference fidelity) — does Sarvam read the spec's test requirements carefully?

If any of these produce surprising results, they are findings for Run 04.

---

*April 11, 2026 — Fourth exercise for opencode-sarvam, designed to validate v2.2.2 discipline on a new language ecosystem (Node.js / JavaScript ESM) with a deceptively nuanced algorithmic task (CSV parser).*
