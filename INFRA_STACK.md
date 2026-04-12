# INFRA_STACK.md — The 4-Layer Build Plan

**Written**: Day 2 morning (2026-04-12, Sunday)
**Companion to**: `THESIS_SWE_BENCH_80.md`
**Purpose**: The operational "how" that the thesis document's "what" points at. This is where vision meets compile errors.

---

## Guiding principles

Before any repo is cloned, here are the rules this build follows. These are not preferences — they are learned from yesterday's five-exercise validation and the failure modes we already paid for.

1. **Study before fork.** Clone repos into `research/` as read-only study targets first. Only fork into `vendor/` or a submodule once we have a concrete integration plan. This prevents 500-line speculative modifications to code we don't yet understand.

2. **One layer at a time, with a findings doc.** Yesterday's pattern worked: focused exercise → capture findings → iterate the scaffold → commit. Every layer integration follows the same loop. No parallel "let's wire up all four at once" work.

3. **Ablation row is the commit boundary.** Each ablation row (A0 through A4) is a distinct checkpoint with its own measurement, its own findings doc, and its own git commit. We can always roll back to the previous row if the next one degrades performance.

4. **The A0 measurement is the first measurement.** Nothing gets built until we know Sarvam 105B's naked baseline on SWE-bench Lite. If the baseline is 5%, we have a different problem than if it's 25%.

5. **Math is glue, not foundation.** Our mathematical contributions go *between* the external repos, not *inside* them. We don't rewrite CodeWiki's internals. We add a thin integration layer that makes CodeWiki emit digital-root-tagged outputs that feed Memori's SQL schema that feeds GitNexus's Graph-RAG query endpoint.

6. **Nothing gets committed to `opencode-sarvam` from the upstream repos.** `research/` is in `.gitignore`. We study the code; we don't bloat our git history with their code.

---

## The four layers — chosen, not just nominated

Yesterday's research gave us multiple candidates per layer. Here are the final choices with the reasoning behind each.

### Layer 2 — Memory Substrate: **Memori**

**Repo**: https://github.com/MemoriLabs/Memori
**License**: Open source (to be verified on clone)
**Why chosen over Hindsight**:
- **SQL-native**: Forensically auditable. Every memory entry is a row in a Postgres/SQLite table. We can run arbitrary SQL queries for debugging. Vector databases are opaque; SQL is transparent.
- **81.95% on LoCoMo benchmark**: Peer-reviewed long-conversation memory accuracy.
- **1,294 avg tokens per query**: Token-efficient retrieval — critical under Sarvam's 128K constraint.
- **Our math plugs in cleanly**: Digital-root indexing becomes an additional SQL column; three-regime tagging becomes an enum column; SLERP state becomes a JSONB column. Zero impedance mismatch.

**Why NOT Hindsight**: The 4-parallel-retrieval architecture is elegant but the MCP dependency adds deployment friction. Memori is simpler to host on Windows for local experiments, which matters for the ablation iteration loop.

**Our mathematical glue on top of Memori**:
- Schema extension: `digital_root INT`, `regime ENUM('R1','R2','R3')`, `slerp_state JSONB`, `berry_phase FLOAT`
- Pre-query filter: DR bucket lookup before any semantic search (88.9% of queries answered without scanning)
- Post-query rerank: regime filter applied to top-k results
- SLERP chain update on every insert (trajectory state lives in the memory itself)

### Layer 3 — Codebase Wiki: **CodeWiki (FSoft-AI4Code)**

**Repo**: https://github.com/FSoft-AI4Code/CodeWiki
**License**: Open source (to be verified on clone)
**Why chosen over DeepWiki Open and OpenDeepWiki**:
- **ACL 2026 peer-reviewed**: Academic rigor means the architecture has been stress-tested by reviewers.
- **Handles 86K-1.4M LOC**: Proven scale on real codebases.
- **7 languages supported**: Python, Go, JavaScript, TypeScript, Java, C++, Rust — covers the full SWE-bench Verified language distribution.
- **Hierarchical decomposition via DP-inspired algorithms**: This is *suspiciously close* to the three-regime partition we already use. The paper describes it as "dynamic programming-inspired hierarchical decomposition" — our R1/R2/R3 (30/20/50) ratios may map directly onto their decomposition buckets.
- **Multi-modal synthesis** (text + diagrams + sequence flows): Our agent can query for a *visualization* of a call chain, not just a text description.

**Why NOT DeepWiki Open**: Point-and-shoot convenience is valuable for a one-off sanity check, but CodeWiki is built for the production path we need.

**Our mathematical glue on top of CodeWiki**:
- Hook into the hierarchical decomposition to tag each bucket with a regime (R1/R2/R3) based on variance metrics
- Augment wiki cross-references with Vyāpti relation types (pervades, restricted-pervasion, Upādhi-defeated) — this gives the agent a *typed* navigation, not just a link-following navigation
- Instrument wiki traversal with Berry phase tracking — the agent's loops on the wiki become measured loops, and large loops get penalized
- Cache wiki lookups in Memori's SQL substrate (wiki ↔ memory convergence) so we don't re-query CodeWiki for the same structure twice

### Layer 4 — Graph-RAG Semantic Index: **GitNexus**

**Repo**: https://github.com/abhigyanpatwari/GitNexus
**License**: Open source (to be verified on clone)
**Trending**: #1 on GitHub April 10, 2026 (1,195 stars in 24 hours)
**Why chosen**:
- **Tree-sitter → knowledge graph → Graph-RAG**: The exact Camp 2 architecture we want. Structural understanding, not vector similarity.
- **Client-side / zero-server**: Runs entirely in browser or locally. Perfect for desktop-deployed Ananta later.
- **Fresh momentum**: Two days old in the trending spotlight means the code is actively being exercised by the community, but not yet ossified. We can learn from the same iteration cycle the author is going through.
- **Tree-sitter parsing**: Same parser we'd use if we built this ourselves — already solved for 40+ languages.

**Risk acknowledged**: Zero-server + newly trending = potentially unstable. Mitigation: we fork at a specific commit SHA and don't chase upstream until our integration is stable.

**Our mathematical glue on top of GitNexus**:
- Quaternion-typed graph nodes: each node gets a `(mean, variance, skewness, kurtosis)` quaternion derived from its call/import statistics, normalized onto S³
- Digital-root bucketing on node IDs for O(1) cross-file jump
- SLERP traversal: walking from node A to node B follows the great-circle arc on S³ rather than ad-hoc graph walks
- Three-regime classification of query results: R1=speculative matches, R2=likely matches, R3=high-confidence matches
- Vyāpti relation types augment the Tree-sitter-derived edges

### Layer 5 — Measurement: **SWE-bench Verified / Lite**

**Repo**: https://github.com/princeton-nlp/SWE-bench (the official harness)
**Why chosen**: It is the benchmark. There is no alternative.
**Iteration pattern**: We run on SWE-bench Lite (300 problems, faster) for each ablation row. We run on full Verified (500 problems) only at A0 (baseline), at A2 (midpoint), and at A4 (final). This balances iteration speed against credibility of the headline number.

---

## The build order (dependency DAG)

```
Step 1:  Clone 4 upstream repos into research/              (30 min)
Step 2:  Write math_layer_design.md                          (1 hr)
Step 3:  Verify SWE-bench harness runs at all on Windows     (unknown)
Step 4:  A0 baseline — Sarvam 105B naked on 10 SWE-bench Lite problems  (2-4 hr)
Step 5:  Write FINDINGS_A0_baseline.md                       (30 min)
Step 6:  Design Memori schema extensions with our math       (2 hr)
Step 7:  Fork Memori into vendor/ with our extensions        (4 hr)
Step 8:  A1 measurement — CodeMathEngine v2.2.4 + naked      (4 hr)
Step 9:  A2 measurement — + Memori with math                 (4-8 hr)
Step 10: Study CodeWiki's decomposition algorithm            (2 hr)
Step 11: Fork CodeWiki into vendor/ with math extensions     (6 hr)
Step 12: A3 measurement — + CodeWiki                         (8 hr)
Step 13: Study GitNexus graph construction                   (2 hr)
Step 14: Fork GitNexus into vendor/ with quaternion nodes    (6 hr)
Step 15: A4 measurement — full stack                         (8 hr)
Step 16: FINDINGS_THESIS_RESULT.md (the headline paper)      (2 days)
```

Note: the above is a *dependency order*, not a schedule. We do not commit to timelines. We commit to the order of operations and the findings docs at each checkpoint.

---

## The first 3 concrete steps for today

1. **Create `research/` directory structure** and add `research/` to `.gitignore`. Clone the four repos shallow (`--depth 1`) into it.

2. **Read each repo's top-level README + one or two key files** to understand the surface. This is the same "read-before-refactor" discipline Clause 13 enforces for code; it applies equally to new dependencies.

3. **Write `math_layer_design.md`** — a first-pass document describing how each of our six mathematical contributions slots into each of the four external layers. This is the artifact that determines whether the integration is a) feasible and b) worth forking for.

After those three steps, we pause, review together, and decide whether to proceed to the A0 baseline measurement or to sharpen the math design further first.

---

## Directory layout (after today's work)

```
opencode-sarvam/
├── THESIS_SWE_BENCH_80.md            (the "what")
├── INFRA_STACK.md                     (this doc, the "how")
├── math_layer_design.md               (the "glue")
├── .opencode/                         (agent config — unchanged)
├── docs/                              (Day 1 findings docs)
├── exercises/                         (Day 1 exercise specs)
├── research/                          (gitignored — upstream repos for study)
│   ├── memori/
│   ├── codewiki/
│   ├── gitnexus/
│   └── swe-bench/
├── vendor/                            (forks we actually modify — created LATER)
└── ablations/                         (one subdirectory per ablation row — created LATER)
    ├── A0_baseline/
    ├── A1_cme_only/
    ├── A2_with_memory/
    ├── A3_with_wiki/
    └── A4_full_stack/
```

---

## What we are NOT doing today

- NOT running SWE-bench. We don't even know if the harness runs on Windows yet. That's the step *after* we clone and study.
- NOT forking any of the upstream repos. `research/` is study-only.
- NOT writing any Python/TS integration code. That comes after the math design doc.
- NOT committing upstream repo code to our git. `.gitignore` handles this.
- NOT making any claims about the A0 baseline until we measure it. The estimates in THESIS_SWE_BENCH_80.md are *prior expectations*, not measurements.

---

*The discipline that got us through five exercises yesterday is the same discipline that will get us through this build: small steps, honest findings, git commits at every meaningful checkpoint, and the conversational mode we reserve for when a spec isn't quite ready to be a spec yet.* 🌿
