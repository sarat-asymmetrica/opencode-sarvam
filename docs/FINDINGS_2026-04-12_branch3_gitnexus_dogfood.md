# Findings — Day 2 Branch 3: GitNexus Dogfood Session

**Date**: 2026-04-12 (Sunday), 06:47 — 06:56 AM (~9 minutes of focused querying)
**Operators**: Sarat Chandra Gnanamgari + Claude Opus 4.6
**Purpose**: Capture what GitNexus actually returns when queried against our own workspace, so the CME v2.3 oracle-query-priority clauses can be written from empirical evidence instead of speculation.

---

## The goal

Per Sarat's morning direction: *"use the branch 3 findings to see if anything else can be added to the addition of the clauses etc and start to test its preparedness for the SWE-bench"*.

The concrete output of this branch is:
1. Empirical understanding of each GitNexus query type (`query`, `context`, `impact`, `cypher`)
2. Concrete examples of their JSON responses
3. Updates to CME v2.3 Clauses 19 and 20 based on those examples
4. A catalog of which queries should be the agent's first choice for which situations

---

## Test methodology

All queries were run against the live `.gitnexus/` index of opencode-sarvam itself, at commit `bf6e586` (Day 2 morning commit after thesis docs were committed). The graph shape at that point:

- **433 nodes** (396 before thesis docs, +37 from the 4 new docs)
- **653 edges** (617 before, +36 from the new docs)
- 10 clusters, 2 processes
- 34 MB on-disk `.gitnexus/lbug` file (LadybugDB backend)

The re-index to pick up the new docs took **4.4 seconds** (down from 8.8s on the first run — incremental indexing is faster). This is a meaningful performance data point: re-indexing the entire workspace after significant doc changes costs less than 5 seconds.

---

## What we learned about each query type

### 1. `gitnexus query <text>` — concept search with structural expansion

**Input**: a natural language phrase
**Output**: JSON with `processes`, `process_symbols`, and `definitions`

**Query 1**: `gitnexus query "Vyapti pervasion"` (niche term, only in our new docs)

Returns sections from `math_layer_design.md` and `THESIS_SWE_BENCH_80.md` with precise line-number ranges:

```
Section:math_layer_design.md:L1:"math_layer_design.md — The Mathematical Glue"     L1-L298
Section:math_layer_design.md:L9:"The starting asymmetry"                            L9-L16
Section:THESIS_SWE_BENCH_80.md:L9:"The claim"                                       L9-...
```

**Observation**: the query returns *hierarchical* section matches — both top-level file headings and specific subsection headings, each with line number ranges. The agent can use this to jump directly to `math_layer_design.md` lines 9-16 without scanning the whole file.

**Query 2**: `gitnexus query "ELEGANCE_CHECK"` (term appears in agent prompt, exercise specs, and test files)

Returns *test functions* from files associated with the concept:

```
Function:sales-report/test_sales_report.py:test_parses_simple_rows         L7-L16
Function:sales-report/test_sales_report.py:test_handles_quoted_cells       L18-L25
Function:dr-classify/drclassify/digital_root_test.go:TestDigitalRoot_singleDigit  L4-L21
Function:dr-classify/drclassify/digital_root_test.go:TestDigitalRoot_multiDigit   L23-L45
```

**Key insight**: GitNexus did *not* just return sections containing the string "ELEGANCE_CHECK". It returned **testable functions structurally associated with files that mention ELEGANCE_CHECK**. This is **structure-aware contextual expansion** — when the agent queries for a concept, it gets back "here's the structural neighborhood where this concept is operationalized", not just "here's where the string appears".

**Implication for Clause 19**: `query` is the right first call when the agent knows *a concept* but doesn't know *which file contains the code*. The structural expansion gives it a ranked list of places to investigate next.

### 2. `gitnexus context <symbol>` — 360° view of a specific symbol

**Input**: a symbol name (or full UID with `--uid`)
**Output**: JSON with `symbol`, `incoming`, `outgoing`, `processes`

**Query**: `gitnexus context test_parses_simple_rows`

Returns:

```json
{
  "status": "found",
  "symbol": {
    "uid": "Function:sales-report/test_sales_report.py:test_parses_simple_rows",
    "name": "test_parses_simple_rows",
    "filePath": "sales-report/test_sales_report.py",
    "startLine": 7, "endLine": 16
  },
  "incoming": {
    "has_method": [
      {"uid": "Class:sales-report/test_sales_report.py:TestParse", "name": "TestParse", ...}
    ]
  },
  "outgoing": {
    "calls": [
      {"uid": "Function:sales-report/sales_report.py:parse_sales_rows", "name": "parse_sales_rows", ...}
    ]
  },
  "processes": []
}
```

**Reading the response**:
- `symbol`: the target node with precise location
- `incoming.has_method`: the class that owns this method (`TestParse` → via `HAS_METHOD` relationship)
- `outgoing.calls`: what this function invokes (`parse_sales_rows`)
- `processes`: execution flows this symbol participates in (empty for a leaf test)

**One context query gives the agent**: *"This test is owned by the `TestParse` class and calls `parse_sales_rows`. To understand why this test might fail, read `parse_sales_rows` next."* That's a complete debugging plan from a single query.

### 3. `gitnexus context <symbol> --content` — 360° view with inline source code

Same as above, but with an extra `content` field containing the full source of the symbol:

**Query**: `gitnexus context parse_sales_rows --content`

The response includes the **complete 33-line function body inline** in the JSON `content` field — Python source, docstring, error handling, everything. Plus the 7 incoming callers (6 test methods + 1 CLI main) each with UIDs and file paths.

**This is the killer move for Clause 19**: a single `context --content` call replaces what would otherwise be:
- 1 Read on `sales_report.py` (to see the function)
- 6 Reads or Greps to find each test caller
- 1 Read on `cli.py` to find the main caller

**8 tool calls → 1 tool call.** That is an 8x reduction on the tool-call budget for "understand this symbol in context" requests. For a mid-sized model like Sarvam 105B where every token counts, this is a material efficiency win.

### 4. `gitnexus impact <target>` — risk-weighted blast radius analysis

**Input**: a symbol name and optional flags (`--direction`, `--depth`, `--include-tests`)
**Output**: JSON with `target`, `direction`, `impactedCount`, `risk`, `summary`, `byDepth`

**Query**: `gitnexus impact parse_sales_rows --include-tests`

Returns:

```json
{
  "target": {"name": "parse_sales_rows", "type": "Function", "filePath": "..."},
  "direction": "upstream",
  "impactedCount": 8,
  "risk": "MEDIUM",                  ← CATEGORICAL RISK LEVEL
  "summary": {
    "direct": 7,
    "processes_affected": 0,
    "modules_affected": 1
  },
  "byDepth": {
    "1": [
      {"name": "test_parses_simple_rows", "relationType": "CALLS", "confidence": 0.9},
      {"name": "test_handles_quoted_cells", "relationType": "CALLS", "confidence": 0.9},
      ... (all 7 direct callers)
    ]
  }
}
```

**Three things to note**:

1. **`risk` is a categorical field** — `LOW`/`MEDIUM`/`HIGH`. The agent can use it as a gate directly: `if risk == "HIGH" then go smaller`. No fuzzy vibes, no heuristic guessing.

2. **`confidence` is < 1.0 even for direct callers** (0.9 here). This reflects Tree-sitter's uncertainty about dynamic dispatch and interface-typed calls. The agent should treat 0.9 as "very likely real, verify if breaking change" and < 0.7 as "probably false positive".

3. **`byDepth` lets the agent choose how deep to look**. For a minimum-viable-diff patch, depth-1 is sufficient; for a sweeping refactor, depth-3 is warranted.

**This is the mathematical gate Clause 20 (regression safety) needs.** Instead of "mentally simulate running the full test suite", the agent runs one query and gets back a categorical risk decision.

### 5. `gitnexus cypher <query>` — raw Cypher against the graph

**Input**: a Cypher-dialect query string
**Output**: JSON with `markdown` (a formatted table) and `row_count`

**LadybugDB dialect note**: It's NOT standard Neo4j Cypher. Some functions are missing. Specifically:
- `type(r)` to get a relationship's type → **does not exist**, throws `Catalog exception: function TYPE does not exist`
- `r.type` as a property access → **works**
- Basic `MATCH (n) RETURN labels(n), count(*)` → **works**

**Query 1**: `MATCH (n) RETURN DISTINCT labels(n) AS type, count(*) AS n ORDER BY n DESC`

Result — node type distribution:
```
Section    289    (markdown headings, dominant in this workspace)
Function    68
File        42
Class        9
Community    9    (clusters, first-class nodes)
Folder       9
Property     5
Process      2
─────────
Total      431
```

**Query 2**: `MATCH ()-[r]->() RETURN r.type AS rel_type, count(*) AS n ORDER BY n DESC`

Result — edge type distribution:
```
CONTAINS        321    (76% — structural hierarchy)
CALLS           120
DEFINES          82
MEMBER_OF        68
HAS_METHOD       49
IMPORTS           7
STEP_IN_PROCESS   6
```

**Analytical observation**: three quarters of edges are `CONTAINS` (Folder→File→Function→Class structural hierarchy). The remaining 25% carry the semantic load (`CALLS`, `DEFINES`, `MEMBER_OF`, `HAS_METHOD`, `IMPORTS`, `STEP_IN_PROCESS`). When we fork GitNexus to add our Vyāpti relation types (`PERVADES`, `RESTRICTED_PERVASION`, `UPADHI_DEFEATED_BY`), these will be new edge types joining the semantic layer — they extend the 25%, they don't replace the 75%.

---

## Implications for CME v2.3

### Clause 19 (Oracle Query Priority) — concrete example added

The clause now names the specific query/output pattern: *"one call to `gitnexus context <symbol> --content` returns the function body, all callers, and all callees in a single JSON response"*. The earlier draft spoke in hypothetical terms; the updated clause shows the actual JSON shape and names the 8:1 tool-call compression ratio.

### Clause 20 (Regression Safety) — upgraded to a numerical gate

The clause now specifies the exact query: `gitnexus impact <symbol> --include-tests --depth 2`, and the decision rule based on the `risk` categorical field:
- `LOW` → proceed
- `MEDIUM` → verify each depth-1 dependant individually
- `HIGH` → re-scope patch smaller, or consider Clause 21 (give-up)

The earlier draft asked the agent to *mentally simulate* regression risk. The updated clause gives it a *computed* risk signal it doesn't need to guess about.

### Clause 22 (proposed) — Graph shape awareness

**Observation from the dogfood**: our workspace has 289 Section nodes vs 68 Function nodes — a doc-heavy topology. A real SWE-bench target codebase (django, sympy, scikit-learn) would invert this ratio, with thousands of Function nodes and relatively few Section nodes.

**Proposed new clause**:

> **Clause 22 — Graph shape introspection before first query.** On a new codebase, before making any substantive query, run `gitnexus cypher "MATCH (n) RETURN DISTINCT labels(n) AS type, count(*) AS n ORDER BY n DESC"` to understand the graph's node type distribution. If the graph is *code-heavy* (Functions >> Sections), prioritize Function-level queries. If the graph is *doc-heavy* (Sections >> Functions), prioritize Section-level queries and use `query` for concept search rather than symbol lookup.
>
> **Rationale**: The optimal query strategy depends on what the graph *contains*. On a well-documented codebase (lots of markdown sections), `query` against concepts is highly effective. On a minimally-documented codebase (few sections, lots of code), `context` and `impact` on specific symbols are the primary tools.

**Decision pending review**: should this be Clause 22, or a sub-note on Clause 19? My preference: a sub-note on Clause 19, because "introspect the graph first" is really *part of* "oracle query priority" rather than a separate discipline.

---

## What we did NOT test (gaps to address later)

1. **Query behavior on non-existent symbols**: we haven't tested what `gitnexus context foo_bar_nonexistent` returns. Likely returns `"status": "not_found"` or similar, but we should verify.

2. **Performance on a large codebase**: opencode-sarvam is only 40 files. A realistic SWE-bench target could be 1000+ files. Query latency at that scale is unknown.

3. **`gitnexus detect_changes`** (from the skill list but not tested): this is the git-diff impact analysis tool. Would be useful for the A2/A3 ablation rows when the agent needs to reason about its own WIP changes.

4. **`gitnexus rename`** (from the skill list): multi-file coordinated rename with confidence-tagged edits. Not critical for MVP, but interesting for refactoring exercises later.

5. **Embeddings mode** (`gitnexus analyze --embeddings`): we ran with embeddings OFF. With embeddings ON, `query` would also do semantic similarity matching via ONNX Runtime. This trades disk/compute cost for richer retrieval. Worth testing once disk space is less tight.

6. **The `--content` flag on other queries**: we only tested it on `context`. It may also apply to `impact`, `query`, etc.

---

## Performance observations

- **Initial index** on 40 files: 8.8 seconds
- **Incremental re-index** after adding 4 thesis docs: 4.4 seconds
- **Query response**: subjectively instant (<100ms for all queries we ran)
- **LadybugDB file size**: 34 MB for our workspace graph

These numbers are *excellent* for research use. On a SWE-bench run where the agent might make 10-20 graph queries per problem, the total graph-query overhead is well under 1 second — negligible compared to model inference time.

---

## What this buys us for the thesis

Three concrete material wins:

1. **Clause 19 and Clause 20 are now based on empirical evidence.** We've upgraded the CME v2.3 draft from speculation to specification. The agent prompt update will reference actual JSON shapes and real tool-call savings.

2. **The 8:1 tool-call compression on `context --content` is a material efficiency claim we can benchmark.** A v2.2.4 agent without GitNexus would make ~8 tool calls to understand a symbol's context. A v2.3 agent with GitNexus makes 1. If each tool call costs 100 tokens of overhead (Sarvam's reasoning wrap), that's 700 tokens of savings per symbol investigation, scaled across the 300 problems of SWE-bench Lite. **This alone is a visible ablation delta**.

3. **GitNexus's risk field turns Clause 20 into a numerical gate.** This is the first time in the CodeMathEngine family that a discipline clause has a *computed input* rather than a *vibes check*. Every other clause relies on the model introspecting its own behavior; Clause 20 now relies on a signal computed outside the model. That is a meaningful architectural shift — we're moving from "prompt discipline" toward "tool-assisted discipline", which is the asymm-pi direction.

---

*Captured from 06:47 AM dogfood session. Ship it.* 🌿🔍
