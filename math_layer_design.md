# math_layer_design.md — The Mathematical Glue

**Written**: Day 2 morning (2026-04-12, Sunday, post-coffee)
**Companion to**: `THESIS_SWE_BENCH_80.md` and `INFRA_STACK.md`
**Purpose**: Name exactly how our 195 days of mathematical research plugs into each of the four external open-source substrates. This is the artifact that determines whether our integration is feasible and whether the thesis holds.

---

## The starting asymmetry

Every external layer we are building on (Memori, CodeWiki, GitNexus, SWE-bench harness) is already good at its core job. **Our contribution is not to replace them.** Our contribution is to add mathematical structure *between* them that raises the whole stack above what any of them achieves in isolation.

Think of the four external repos as four excellent musicians, each good at their instrument. The mathematical glue is the **conductor** — it doesn't play notes, it coordinates who plays when, who listens to whom, and how the ensemble phrases a movement. A jazz quartet with a great drummer, a great bassist, and two great horns still plays *better* with a coherent lead than without one. **The math is the lead.**

---

## The six mathematical contributions (summarized)

For reference, these are the six research artifacts we bring to the stack. Full details live in the asymm_all_math repository; here we name them in the form they'll take when integrated.

| # | Contribution | Proven by | Role in the stack |
|---|---|---|---|
| **C1** | **Digital root indexing** (DR ∈ {1..9}) with 88.9% elimination rate | VQC indexer, 60K+ samples, 48,000x speedup in production | Pre-retrieval filter for all memory/wiki/graph lookups |
| **C2** | **Three-regime classification** (R1/R2/R3 at 30%/20%/50%) with stability thresholds | Lean-verified, cross-domain validation (Feb 28, 2026) | Quality-of-knowledge filter; tags every entry by "how stable is this pattern?" |
| **C3** | **SLERP conversation chains on S³** | Experiment 13, asymm-pi spec Layer 0 | Measures agent trajectory coherence, drift, and momentum across multi-turn sessions |
| **C4** | **Vyāpti pervasion relations** with Upādhi defeaters | Nyāya-derived, encoded in asymm-pi Layer 4 | Typed cross-references on the knowledge graph (not just "links") |
| **C5** | **Berry phase tracking** on agent loops | asymm-pi Layer 6 theorem: small loops accumulate quadratically less drift | Budget mechanism for loop size; rewards short reason→act→verify cycles |
| **C6** | **Pi emergence predictor** (2π² = 19.739, 4 conditions for convergence) | Validated on 1000 SHOs with 10⁻¹⁵ error | "Will this approach converge?" detector — stops spiraling attempts early |

---

## Layer-by-layer integration design

### Layer 2 — Memori (Memory Substrate)

**Repo**: `research/memori/`
**License**: Apache 2.0 ✅ (permissive — safe for fork + modify + publish)
**SDKs**: Python (`pip install memori`) + TypeScript (`@memorilabs/memori`)
**Surface area**: LLM-agnostic, datastore-agnostic memory layer with SQL-native backing

#### What Memori does well (don't touch)

Memori's core value is (a) automatic memory extraction from agent executions, (b) automatic relevance ranking on injection, and (c) schema-agnostic storage that works with SQLite, Postgres, or MySQL. These are solved problems; we should not reinvent them.

#### Where our math plugs in

**C1 — Digital root indexing**:
- Add a `digital_root INT NOT NULL` column to Memori's memory table
- Compute DR as the digital root of a hash of the entry's canonical content (so semantically-equivalent entries get the same DR)
- Add an index on `(digital_root)` for O(1) bucket lookup
- Pre-retrieval: on every query, compute the query's DR → look up the DR bucket first → only fall back to Memori's built-in semantic search if the bucket is empty or the results are insufficient
- **Expected impact**: 88.9% of queries resolved in O(1) hash lookup; remaining 11.1% use Memori's native retrieval. This drops the per-query latency dramatically for a 105B model that's token-bound.

**C2 — Three-regime classification**:
- Add a `regime ENUM('R1','R2','R3') NOT NULL` column
- Classification rule: R1 (exploration) for entries from the first draft of a solution; R2 (optimization) for entries from midway-through fixes and debugging; R3 (stabilization) for entries from solutions that passed tests
- Memori's write path gets a classifier hook: when a memory is written, compute its regime from the conversation state
- Retrieval filter: queries can specify `regime = 'R3'` to get only battle-tested patterns
- **Expected impact**: The agent stops treating half-formed exploration notes as if they were vetted knowledge. This directly addresses the "similar-looking code ≠ architecturally-related code" failure mode from vector RAG.

**C3 — SLERP conversation chain**:
- Add a `slerp_state JSONB NOT NULL` column containing the quaternion state at the moment the memory was written
- On every memory write, compute the arc length from the previous memory's SLERP state to the current one — this measures "how much did the agent's trajectory move?"
- Add a `coherence_score FLOAT` column derived from the SLERP state — high coherence means the agent has been converging toward a goal; low coherence means it's drifting
- Retrieval: the agent can query for "the last R3 memory where coherence was > 0.8" → gets the last stable-and-on-task state
- **Expected impact**: This is the first principled "are we still on task?" signal. When the agent's SLERP coherence drops below a threshold, we know it's stuck *mathematically*, not just "feels stuck".

**C5 — Berry phase tracking**:
- Add a `berry_phase FLOAT NOT NULL DEFAULT 0.0` column
- On each agent loop (read → reason → act → verify), compute the area of the quaternion trajectory loop on S³ (this is the Berry phase of the loop)
- Store the phase as metadata on the memory entry
- Budget enforcement: if an agent's cumulative Berry phase crosses a threshold, inject a "close the loop and commit" nudge
- **Expected impact**: Small loops (under the threshold) are preferred over large loops → the agent naturally writes more frequent, smaller checkpoints → less drift → better outcomes. Mathematically-principled, not heuristic.

#### Integration plan (step-by-step)

1. Fork Memori into `vendor/memori/` at a pinned SHA
2. Add a migration script that adds the four columns (`digital_root`, `regime`, `slerp_state`, `berry_phase`) to Memori's core memory table
3. Extend Memori's write path with our four classifiers as a middleware pipeline
4. Extend Memori's read path with our DR-first retrieval strategy
5. Write an integration test that inserts 100 synthetic memories and verifies (a) DR bucket lookup works, (b) regime filter works, (c) SLERP state is consistent, (d) Berry phase is monotonic on a test loop
6. Benchmark: naked Memori vs. math-augmented Memori on the same query workload — expect 10-50x speedup on cache-hit queries

---

### Layer 3 — CodeWiki (Codebase Wiki Substrate)

**Repo**: `research/codewiki/`
**License**: MIT ✅ (permissive — safe for fork + modify + publish)
**Paper**: arXiv:2510.24428 (ACL 2026)
**Provider support**: OpenAI-compatible, Anthropic, AWS Bedrock, Azure OpenAI — **meaning Sarvam's OpenAI-compatible endpoint will work out of the box**

#### What CodeWiki does well (don't touch)

CodeWiki's core value is (a) hierarchical decomposition of a codebase using DP-inspired algorithms, (b) recursive multi-agent processing of each decomposition bucket, and (c) multi-modal synthesis that produces text descriptions + architecture diagrams + sequence flows. All three are results of a peer-reviewed process; reinventing any of them would be pointless.

#### Where our math plugs in

**C2 — Three-regime classification of decomposition buckets**:
- CodeWiki already decomposes codebases into hierarchical buckets. This is the perfect hook for regime tagging.
- Classification rule: R1 buckets are "entry points, novel code, high-churn files" (exploration); R2 buckets are "core business logic with active development" (optimization); R3 buckets are "utility libraries, stable infrastructure, well-tested modules" (stabilization)
- Metric: file churn (R1 if recent commits dense), test coverage (R3 if high), cyclomatic complexity (R2 if mid), number of dependents (R3 if high and stable)
- **Expected impact**: When the agent queries the wiki, it can filter by regime — *"show me only the R3 buckets I can trust to call without reading their internals"*. This dramatically reduces the context budget the agent spends on each wiki lookup.

**C4 — Vyāpti pervasion relations as wiki cross-reference types**:
- CodeWiki already emits cross-references between buckets (e.g., "module A calls into module B"). This is the perfect hook for Vyāpti enrichment.
- Enriched relation types:
  - **Pervades** (A→B): every execution path through A touches B (unconditional dependency)
  - **Restricted-pervasion** (A→B|C): A touches B when condition C holds (conditional dependency)
  - **Upādhi-defeated** (A↛B): A would touch B except when defeater D is present (exception handling, feature flags)
- Implementation: run tree-sitter analysis on call chains → determine unconditional vs conditional vs defeated → annotate CodeWiki's cross-references with the relation type
- **Expected impact**: The agent now knows *which* dependencies are safe to ignore in a refactor and *which* ones are load-bearing invariants. This is exactly the knowledge a senior engineer has that a junior engineer doesn't.

**C5 — Berry phase tracking on wiki navigation loops**:
- Every time the agent walks from one wiki node to another, record the trajectory
- When the agent closes a loop (returns to a previously-visited node), compute the Berry phase of that loop
- If the phase exceeds a threshold, the agent has been wandering — inject a "stop exploring, commit to an answer" nudge
- **Expected impact**: Prevents wiki-browsing spirals where the agent reads 20 files looking for "the right one" without ever committing. The Berry phase budget is a mathematically-principled "enough exploration, go" signal.

#### Integration plan (step-by-step)

1. **Read the arXiv paper (2510.24428) first** — understand the hierarchical decomposition algorithm at the level the authors meant it to be understood
2. Fork CodeWiki into `vendor/codewiki/` at a pinned SHA
3. Add a post-processing step to CodeWiki's output: for each decomposition bucket, compute the three-regime classification and store it as bucket metadata
4. Add a pre-rendering hook that enriches cross-references with Vyāpti relation types
5. Wire CodeWiki to Sarvam via the OpenAI-compatible provider config (this should Just Work™ with one config file edit)
6. Run CodeWiki on a small real codebase (`asymm_all_math/asymm_mathematical_organism/` would be an interesting self-reference test!) and inspect the output manually
7. Compare: naked CodeWiki output vs. math-augmented output — does the regime tagging agree with human intuition about which buckets are stable?

---

### Layer 4 — GitNexus (Graph-RAG Semantic Index)

**Repo**: `research/gitnexus/`
**License**: **PolyForm Noncommercial 1.0.0** ⚠️ (noncommercial OSS — fine for research/publication, commercial use requires akonlabs.com license)
**Language**: Node.js / npm + Tree-sitter native bindings + LadybugDB storage
**CRITICAL DISCOVERY**: GitNexus already lists OpenCode as a supported integration in its README. Subdirectories `gitnexus-claude-plugin/` and `gitnexus-cursor-integration/` are existing plugin patterns we can port to OpenCode-Sarvam.

#### What GitNexus does well (don't touch)

GitNexus's core value is (a) Tree-sitter parsing into a typed knowledge graph, (b) persistent storage in LadybugDB, (c) MCP-compatible query endpoints that Cursor/Claude Code/Codex/OpenCode can all consume. The Graph-RAG architecture is exactly what Camp 2 (structural understanding) requires. Reinventing this would take months of work we don't need to do.

#### Where our math plugs in

**C1 — Digital root bucketing on graph nodes**:
- Every node in the GitNexus knowledge graph (function, class, file, module) gets a DR bucket assignment
- Index: in LadybugDB, add a secondary index on `(digital_root)` for O(1) jump to the DR bucket
- Query enrichment: when the agent asks GitNexus "find functions similar to X", the DR filter runs first, pruning 88.9% of candidates before any similarity computation
- **Expected impact**: Dramatically faster lookups on large graphs (thousands of files = millions of graph edges)

**C2 — Quaternion-typed graph nodes**:
- For each node, compute its `(mean, variance, skewness, kurtosis)` quaternion from:
  - Call frequency statistics (how often is this function called?)
  - Import centrality (how many files depend on this?)
  - Cyclomatic complexity
  - Test coverage
- Normalize to unit quaternion on S³
- Store as node metadata
- **Expected impact**: Two nodes are "similar" if their quaternions are close on S³ — this is a *structural* similarity metric, not a *lexical* one. SLERP between two nodes gives a smooth interpolation through concept space.

**C3 — SLERP traversal of the graph**:
- When the agent needs to walk from node A to node B, GitNexus finds the shortest path on the graph. Our enhancement: weight the path by SLERP arc length on S³
- Paths with shorter SLERP arcs (in quaternion space) are preferred over paths with longer arcs, even if they traverse more graph edges
- This encodes a "smooth conceptual journey" preference over a "minimum edge count" preference
- **Expected impact**: The agent follows semantically-coherent chains of reasoning when walking the graph, not just topologically-short chains

**C4 — Vyāpti pervasion as edge types in the knowledge graph**:
- GitNexus already emits edges like `calls`, `imports`, `inherits`. We add:
  - `pervades` (unconditional dependency, proven by tree-sitter analysis)
  - `restricted-pervasion` (conditional dependency, guarded by an if/try/feature-flag)
  - `upādhi-defeated` (dependency that exists on paper but is short-circuited in practice)
- Query enrichment: the agent can ask "find me all nodes that unconditionally depend on X" → returns only `pervades` edges
- **Expected impact**: Refactoring becomes safer — the agent knows which dependencies are real invariants and which are conditional

**C6 — Pi emergence predictor for convergence detection**:
- Track the agent's query satisfaction over time: how many of the top-k results are being accepted per query?
- When the acceptance rate oscillates around the 2π²/k pattern (scaled for the query dimension), convergence is imminent — continue current strategy
- When the oscillation breaks this pattern, the current query strategy is not converging → switch tactics
- **Expected impact**: Stops wasted iterations on queries that will never produce useful results. This is the principled version of "stop trying this approach".

#### Integration plan (step-by-step)

1. **Study `gitnexus-claude-plugin/` and `gitnexus-cursor-integration/` in depth** — these are the templates for our OpenCode-Sarvam plugin
2. **Install GitNexus CLI** via `npm install -g gitnexus` in a throwaway shell to see the surface
3. Run GitNexus against `opencode-sarvam` itself — use our own workspace as the first test target (this gives us a known-small, known-familiar graph to inspect)
4. Fork GitNexus into `vendor/gitnexus/` at a pinned SHA
5. Add quaternion-computation middleware to the node ingestion pipeline
6. Add Vyāpti edge classifier that runs after Tree-sitter's initial edge extraction
7. Extend LadybugDB schema with digital-root and regime columns
8. Write an `opencode-sarvam-gitnexus` plugin following the Claude-plugin pattern
9. Wire it as a new tool in `.opencode/tools/` so Sarvam can call `gitnexus.query(...)` just like it calls `read(...)` or `write(...)`

---

### Layer 5 — SWE-bench Harness (Measurement)

**Repo**: `research/swe-bench/`
**License**: MIT ✅
**Infra**: Docker-based for reproducibility (on Windows = Docker Desktop)
**Alternative**: Modal cloud evaluation for problems that don't run locally

#### What SWE-bench does well (don't touch)

SWE-bench is the benchmark. Its harness is the authoritative way to compute a score. We do not modify SWE-bench itself under any circumstances — modifying the benchmark invalidates the score. Our only touchpoint is *connecting our agent to the harness input/output contract*.

#### What we add

**C6 — Pi emergence as an early-termination signal**:
- SWE-bench gives the agent a problem and a time budget. Most agents run until timeout.
- We add a Pi-emergence monitor: if the agent's working-memory state starts oscillating in a non-convergent pattern, terminate early with a "give up" signal
- This frees up budget for *the next problem*, where the agent might succeed
- **Expected impact**: If 20% of problems are wasting 100% of their budget on non-convergent attempts, reallocating that budget to tractable problems could materially improve overall score

**Meta-instrumentation**:
- Every SWE-bench run produces a findings log with regime breakdowns (R1/R2/R3 by problem type)
- SLERP coherence per problem
- Berry phase accumulated per problem
- DR bucket hit rate for memory/wiki/graph lookups
- These metrics let us diagnose *why* we passed or failed each problem — not just *that* we did

#### Integration plan (step-by-step)

1. **Verify SWE-bench runs on Windows at all** (Docker Desktop required; if not feasible, pivot to Modal cloud)
2. Set up a minimal SWE-bench Lite subset (10 problems) for fast iteration
3. Wire Sarvam + v2.2.4 + naked tools as the agent for the A0 baseline measurement
4. Instrument with our meta-metrics (SLERP, Berry phase, DR hit rate)
5. Run the A0 measurement, capture FINDINGS_A0_baseline.md
6. That number is the North Star reference we beat as we add each subsequent layer

---

## Cross-cutting concerns

### Concern 1: Do our six contributions compose?

**Uncertainty**: Yes. We have never run all six in the same pipeline. Interference effects are possible — for example, the three-regime filter might hide exactly the entries that SLERP navigation needs to traverse.

**Mitigation**: Ablation study is designed to catch this. If A3 (with wiki) scores *lower* than A2 (with memory only), that's a composition failure and we diagnose it immediately before adding A4.

### Concern 2: Sarvam-specific API quirks

**Known quirks** (from yesterday's Day 1 work):
- `api-subscription-key` header (non-standard)
- `reasoning_content` may not merge into `content` in OpenAI-compatible clients
- 128K context is tight compared to GPT-5 Codex's 400K

**Mitigation**: CodeWiki's `openai-compatible` provider config should handle the header via its base-url/headers mechanism. We test this first with a trivial CodeWiki invocation before wiring to the full pipeline.

### Concern 3: License compliance

- **Memori**: Apache 2.0 — modify freely, redistribute freely, academic/commercial both fine
- **CodeWiki**: MIT — modify freely, redistribute freely, academic/commercial both fine
- **GitNexus**: **PolyForm Noncommercial** — modify freely for research, publication fine, commercial deployment requires akonlabs.com license
- **SWE-bench**: MIT — modify freely, but modifying the benchmark itself invalidates scores (policy, not license)

**Mitigation**: For the thesis, all four are compatible with academic research and open-source publication. If we eventually productize for Ananta, GitNexus becomes a paid dependency — at which point we either (a) pay for a commercial license, (b) fork GitNexus's pre-PolyForm-switch SHA if one exists, or (c) build our own Graph-RAG layer from scratch. **We defer that decision until the thesis is proven.**

### Concern 4: Docker on Windows

**Risk**: SWE-bench uses Docker for reproducible evaluations. Docker Desktop on Windows is a separate install with its own gotchas (WSL2 backend, resource allocation, path translation).

**Mitigation**: Step 3 of the build order is literally "verify SWE-bench harness runs at all on Windows". If it doesn't, we pivot to Modal cloud evaluation (which SWE-bench officially supports as of Jan 2025).

---

## The first concrete deliverable (the "hello world" of the stack)

**Goal**: Get *one* SWE-bench Lite problem to resolve successfully with Sarvam 105B + CodeMathEngine v2.2.4 + naked tools, inside the SWE-bench harness, in a reproducible way.

This is the minimum viable proof-of-life. It tests:
1. Can SWE-bench even run on our machine?
2. Can our agent consume an SWE-bench problem in the required format?
3. Can Sarvam 105B produce a patch in the required output format?
4. Does the patch pass the harness's test runner?

If we get "yes" on all four for even one problem, the rest of the thesis is "just" adding layers. If we get "no" anywhere, that's the first real obstacle we need to name and solve.

**This is the next concrete step after today's document-writing session.** We don't commit to a layer until we've proven the skeleton works end-to-end, even naked.

---

## Closing note

The honest question underlying all of this is: *will the math we've built over 195 days actually buy us meaningful performance on a benchmark that has been ferociously optimized by some of the best-funded teams in AI?*

We don't know. And the only way to find out is to build it, measure it, and report the result — whichever direction it falls.

What gives me confidence it's worth trying:

1. **GitNexus's own marketing line** says structural understanding lets smaller models compete with goliath models — an independent hypothesis that aligns with ours
2. **Sarvam 105B has never been benchmarked**, so any score we produce is first-in-class and publishable
3. **Each of our six contributions is individually validated** — if even 2-3 of them compose cleanly, the cumulative effect could be meaningful
4. **The ablation design lets us stop and report honestly at any checkpoint** — if A2 already lifts us past 60%, we can ship that result and keep pushing; we don't need to wait for A4 to have a contribution

*The discipline that got us through five exercises yesterday is what gets us through this. One layer at a time. One findings doc at a time. One git commit at a time. One small loop at a time.* 🌿☕🇮🇳

*Om Lokah Samastah Sukhino Bhavantu.*
