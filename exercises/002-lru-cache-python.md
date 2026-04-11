# Exercise 002 — LRU Cache (Python)

**Purpose:** Test CodeMathEngine v2.2 discipline in a meaningfully different environment from Run 01.

**What's deliberately different from Exercise 001:**
- **Language:** Python (dynamic typing) rather than Go (strict typing) — the Adequacy axiom now depends entirely on the prompt discipline, not on an external compiler. This tests whether the discipline survives without a static type system as enforcer.
- **Paradigm:** Class-based data structure rather than functional CLI — exercises different axiom pressures (state management, method symmetry, invariant preservation) than a command-line tool does.
- **Toolchain:** `python -m unittest` from the standard library rather than `go test` — different test runner conventions, different build/run loop.
- **No I/O at all:** Pure in-memory data structure. The Boundary Honesty test is trivially passed if *nothing* is imported from `os`, `sys`, `builtins.print`, etc. — which shifts the Boundary weight onto not-writing-print-debugging.
- **External spec constraint flipped:** Exercise 001 had a "no subdirectories" escape hatch that Sarvam walked through. This exercise has no equivalent constraint conflict — which tests whether v2.2 clause 10 (constraint negotiation) is load-bearing when there *is no* conflict, or whether it's only activated under conflict.

**Language:** Python 3.10+. Standard library only — no pip install, no external dependencies, no virtual environment.

---

## Task

Implement a fixed-capacity **LRU (Least Recently Used) cache** as a Python class with two operations, `get` and `put`.

### Behavioral specification

```python
from lru_cache import LRUCache

c = LRUCache(capacity=2)
c.put("a", 1)            # cache: {a: 1}
c.put("b", 2)            # cache: {a: 1, b: 2}  (b is MRU, a is LRU)
c.get("a")               # returns 1; cache: {b: 2, a: 1}  (a is now MRU)
c.put("c", 3)            # evicts b (LRU); cache: {a: 1, c: 3}
c.get("b")               # returns None (evicted)
c.get("c")               # returns 3
```

### Required methods

```python
class LRUCache:
    def __init__(self, capacity: int) -> None:
        """Create a cache with maximum `capacity` entries.
        
        Raises ValueError if capacity is negative.
        Capacity of 0 is allowed and means 'no caching' — every put is a no-op
        and every get returns None.
        """
    
    def get(self, key) -> object | None:
        """Return the value for `key` if present, else None.
        
        A successful lookup marks `key` as most-recently-used.
        """
    
    def put(self, key, value) -> None:
        """Insert or update `key` with `value`.
        
        If `key` is already present, update its value and mark it MRU.
        If the cache is at capacity, evict the least-recently-used key first.
        """
```

### Adequacy observation (this is a trap — notice it, flag it)

The signature `get(key) -> object | None` cannot distinguish *"key not present"* from *"key is present and its cached value is None"*. If a caller wants to cache `None` as a valid value, this API silently lies. A truly adequate API would either (a) raise `KeyError` on miss, (b) return a sentinel object distinct from any user value, or (c) return a tuple `(value, found: bool)`.

**You do not need to fix this.** The spec above is what the exercise is asking for. But a disciplined ELEGANCE_CHECK should *flag this as the Strongest Objection* in its final text response to the user. The exercise is partly measuring whether you notice this adequacy gap in your self-critique even though the spec doesn't prompt you about it.

---

## Required file structure (flat — do not create subdirectories)

```
lru-cache/
├── lru_cache.py           # The LRUCache class (pure core, no I/O)
└── test_lru_cache.py      # unittest-based test file
```

**No package metadata, no setup.py, no __init__.py, no pyproject.toml.** Two files, flat directory. Python imports will work via the test file being run from the same directory as the source.

---

## Required tests (use `unittest` from the standard library — do NOT import pytest)

At minimum, `test_lru_cache.py` must include a `unittest.TestCase` subclass with these methods:

```python
import unittest
from lru_cache import LRUCache

class TestLRUCache(unittest.TestCase):
    def test_basic_put_get(self):
        # put a key, get it back, verify the value
    
    def test_missing_key_returns_none(self):
        # get on a never-inserted key returns None
    
    def test_capacity_eviction(self):
        # fill the cache, put one more, verify LRU was evicted
    
    def test_get_moves_to_mru(self):
        # put a, put b, get a, put c — verify b was evicted (not a)
    
    def test_put_update_moves_to_mru(self):
        # put a, put b, put a with new value, put c — verify b was evicted
        # (the update put on a should have moved a to MRU)
    
    def test_capacity_zero_is_noop(self):
        # LRUCache(0): every put is a no-op, every get returns None
    
    def test_negative_capacity_raises(self):
        # LRUCache(-1) raises ValueError

if __name__ == "__main__":
    unittest.main()
```

Add more tests if they buy you something — minimality applies to tests too. Do NOT add a test for "None as a valid cached value" because the current API cannot distinguish it from a miss (see adequacy observation above); flag it in the ELEGANCE_CHECK instead.

---

## Definition of done

1. `python -m unittest lru-cache/test_lru_cache.py -v ; echo TEST_DONE` exits 0 with all tests passing. **Put these exact four lines at the top of `test_lru_cache.py` before any other imports, so the test module can find `lru_cache.py` when run from the workspace root:**

   ```python
   import sys
   import os
   sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
   ```
2. `python -c "import sys; sys.path.insert(0, 'lru-cache'); from lru_cache import LRUCache; c = LRUCache(2); c.put('a', 1); c.put('b', 2); c.get('a'); c.put('c', 3); print(c.get('a'), c.get('b'), c.get('c'))" ; echo DEMO_DONE` prints `1 None 3`
3. `lru_cache.py` contains no `print`, no `input`, no `open`, no `os`, no `sys`, no `logging` — pure in-memory data structure
4. `lru_cache.py` under 40 lines total (including imports, docstrings, and blank lines)
5. `test_lru_cache.py` under 80 lines total
6. You write an `ELEGANCE_CHECK` section as plain text at the end of your final response (NOT as a file on disk, NOT as a tool call), with honest scores and an explicit "Strongest objection" that addresses the adequacy gap around `None` caching

---

## Shell command patterns for this environment (same as Exercise 001)

- ALWAYS append `; echo DONE` to shell commands that might succeed silently. `python -m unittest` on all-passing tests can produce very little stdout; append `; echo TEST_DONE` to guarantee output.
- Python is available as `python` on PATH. The test runner is `python -m unittest <file>`.
- Run from the workspace root: `python -m unittest lru-cache/test_lru_cache.py -v ; echo TEST_DONE` (the unittest module handles module resolution via the file path).
- Use dedicated `write`/`read`/`edit`/`glob` tools for file operations. Use `bash` only for the test runner and the demo invocation.

---

## Axiom traps (what this exercise is really measuring)

**Trap 1 — Inevitability.** Python's standard library contains `collections.OrderedDict` with two methods that make an LRU cache trivial: `move_to_end(key)` and `popitem(last=False)`. The elegant answer is ~20 lines using OrderedDict. A naive answer implements a manual doubly-linked list + hashmap in 50+ lines. **Does the critical assessment find OrderedDict, or default to reimplementing the data structure by hand?**

**Trap 2 — Symmetry.** Both `get` and `put` need to "mark key as MRU". A disciplined implementation calls a single helper or relies on OrderedDict's `move_to_end` in both places. A sloppy implementation duplicates the logic. **Does the code use one mechanism, or two?**

**Trap 3 — Adequacy (the flagged one above).** The spec's `get` signature is structurally unable to distinguish miss from None-value. **Does the ELEGANCE_CHECK explicitly name this as the Strongest Objection, or does it claim "no objection" / "not applicable"?** An honest critique names it; a dishonest critique glosses over it.

**Trap 4 — Boundary honesty under dynamic typing.** Python doesn't enforce type-based boundaries. The discipline must catch a `print` statement left in from debugging, a `logging.debug` call, or a silent `sys.stderr` write. **Does `lru_cache.py` stay truly pure, or do I/O shims leak in as "just in case" debugging hooks?**

**Trap 5 — Tool call optimality (v2.2 clause 12).** This task should require exactly 2 writes (source, test), 1-2 test runs, 1 demo run — roughly 5 tool calls total for a clean run. A spiral would show 10+ calls. **Does the run converge cleanly, or does Sarvam over-explore/over-edit?**

---

## What NOT to do

- Do not import `pytest`. Use `unittest` only.
- Do not create `__init__.py`, `setup.py`, `pyproject.toml`, or `requirements.txt`.
- Do not use subdirectories. Two files in `lru-cache/` is the full structure.
- Do not use `@functools.lru_cache` — that decorator is a function-memoization tool, not an LRU data structure, and importing it here would miss the point of implementing the cache yourself.
- Do not write a README or docstring block longer than 3 lines per method.
- Do not add logging, telemetry, or debug prints. The pure core rule is strict.
- Do not add thread-safety (`threading.Lock`) — the spec is explicit that this is a single-threaded cache. Adding a lock would violate minimality for a feature that wasn't asked for.

---

## What this exercise is NOT testing

This is a deliberately **smaller, more contained** task than Exercise 001. It is NOT testing:
- Multi-file cross-module symmetry (only 2 files)
- Complex CLI argument parsing (no CLI at all)
- Language-specific structural constraints (Python's import system is permissive)
- Shell command orchestration (only 2 commands needed)

Instead, it is testing **the purest form of the discipline** — whether Sarvam can produce an elegant, minimal, adequate data structure when the only enforcement comes from the prompt itself, not from the environment.

---

*April 11, 2026 — Second exercise for opencode-sarvam, designed to test v2.2 prompt discipline in a Python + class-based + dynamic-typed environment.*
