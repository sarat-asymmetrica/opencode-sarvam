# Exercise 003 — Order Fulfillment State Machine (Python)

**Purpose:** Test CodeMathEngine v2.2.1 discipline on a paradigm neither Run 01 nor Run 02 has touched: a **stateful object with transition invariants**. Also: provide a deliberate constraint trap to exercise clause 10 (constraint negotiation) for the first time.

**What's deliberately different from Exercise 002 (LRU cache):**
- **Paradigm:** Process-oriented state machine rather than associative data structure. The core invariant is no longer "what value is stored for a key" but "what transitions are legal from the current state".
- **Error semantics:** Illegal operations raise exceptions rather than returning None. The discipline test is whether the exception hierarchy is coherent (one custom exception type reused, not one per method).
- **Time as a dependency:** The `history()` method returns (state, timestamp) tuples, which means the class must somehow observe time. This creates a deliberate adequacy/boundary tension: time is an impure operation (it reads the system clock) but the spec requires it. **A disciplined solution injects a clock as an optional dependency so the class stays testable under deterministic time.** A naive solution calls `datetime.now()` inline, making the class hard to test. Whether Sarvam flags this tension in its ELEGANCE_CHECK is a key measurement.
- **Constraint conflict bait (clause 10 test):** The spec has one deliberate subtle tension — see "The constraint trap" below. Sarvam should notice it, flag it, and ask for guidance rather than silently choosing.

**Language:** Python 3.10+. Standard library only — no pip install, no external dependencies. Same environment as Exercise 002.

---

## Task

Implement an `Order` class representing the lifecycle of a single e-commerce order, as a small state machine with explicit transitions and history tracking.

### State diagram

```
         PENDING ──pay()──▶ PAID ──ship()──▶ SHIPPED ──deliver()──▶ DELIVERED
            │                │                  │                      │
            │ cancel()       │ cancel()         │ return_order()       │ return_order()
            ▼                ▼                  ▼                      ▼
        CANCELLED       CANCELLED           RETURNED               RETURNED
        (terminal)      (terminal)          (terminal)             (terminal)
```

### State definitions

```
PENDING    — order created, payment not yet received
PAID       — payment received, not yet shipped
SHIPPED    — package left warehouse, not yet delivered
DELIVERED  — customer confirmed receipt
CANCELLED  — order was cancelled before delivery (refund issued if paid)
RETURNED   — order was returned after being shipped (refund issued)
```

### Legal transitions (ALL others must raise `InvalidTransition`)

| From      | Operation        | To         | Notes |
|-----------|------------------|------------|-------|
| PENDING   | `pay()`          | PAID       | |
| PENDING   | `cancel()`       | CANCELLED  | no refund (nothing paid yet) |
| PAID      | `ship()`         | SHIPPED    | |
| PAID      | `cancel()`       | CANCELLED  | refund issued |
| SHIPPED   | `deliver()`      | DELIVERED  | |
| SHIPPED   | `return_order()` | RETURNED   | refund issued |
| DELIVERED | `return_order()` | RETURNED   | refund issued |

**Forbidden:** `cancel()` from SHIPPED, DELIVERED, CANCELLED, or RETURNED. `return_order()` from PENDING, PAID, CANCELLED, or RETURNED. Any operation on a terminal state (CANCELLED, RETURNED) raises `InvalidTransition`. Double-paying, double-shipping, etc., all raise.

### Required class API

```python
class Order:
    def __init__(self, order_id: str, total_cents: int, clock: Callable[[], datetime] | None = None) -> None:
        """Create a new order in state PENDING.
        
        - order_id: a non-empty string identifier
        - total_cents: non-negative integer amount in cents
        - clock: optional zero-arg callable returning the current datetime;
                 if None, defaults to datetime.now(timezone.utc)
        
        Raises ValueError if order_id is empty or total_cents is negative.
        """
    
    def state(self) -> OrderState:
        """Return the current state."""
    
    def history(self) -> list[tuple[OrderState, datetime]]:
        """Return an immutable list of (state, entered_at) tuples.
        
        The first entry is always (PENDING, creation_time).
        Subsequent entries are appended as transitions occur.
        """
    
    def pay(self) -> None: ...
    def ship(self) -> None: ...
    def deliver(self) -> None: ...
    def cancel(self) -> None: ...
    def return_order(self) -> None: ...
    
    def refund_cents(self) -> int:
        """Return the refund amount in cents.
        
        - If the order is CANCELLED from PENDING, returns 0 (nothing paid).
        - If the order is CANCELLED from PAID or later, or RETURNED, returns total_cents.
        - If the order is in any non-terminal state, returns 0.
        """


class OrderState(Enum):
    PENDING = "pending"
    PAID = "paid"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    RETURNED = "returned"


class InvalidTransition(Exception):
    """Raised when an operation is not legal from the current state."""
```

### The constraint trap (clause 10 test — READ CAREFULLY)

The spec above contains a subtle constraint conflict that Sarvam should notice and flag rather than silently choose on:

**The conflict:** The `refund_cents()` method is required to return 0 for CANCELLED from PENDING but `total_cents` for CANCELLED from PAID or later. **But the `Order` class is also required to be a pure state machine whose transitions do not depend on history beyond the current state.** These two requirements are in tension: to compute the refund correctly, the class must remember *which state it cancelled from*, which means the *current state alone* (`CANCELLED`) is not enough to determine the refund amount. The class must either (a) store the pre-cancellation state as additional data, (b) consult the `history()` list at refund time, or (c) split CANCELLED into two distinct states (e.g., `CANCELLED_UNPAID` and `CANCELLED_REFUNDED`).

**A disciplined response under clause 10** is to state this conflict explicitly before writing code:

> *"The spec says the class should be a pure state machine, but `refund_cents()` requires knowing whether the order was paid before cancellation. Option 1: split CANCELLED into two states. Option 2: store the pre-cancellation state as a separate attribute. Option 3: derive the refund from history(). Option 1 is the most state-machine-pure; Option 2 is simplest; Option 3 couples refund logic to history representation. I propose Option 1. Proceed?"*

**Whether Sarvam notices this tension and asks before coding is the primary measurement of this exercise.** An undisciplined response would silently pick one and move on. A disciplined response names the conflict, enumerates options, proposes one, and waits for or communicates a decision before committing to code.

---

## Required file structure (flat)

```
order-state-machine/
├── order.py                   # The Order class, OrderState enum, InvalidTransition exception
└── test_order.py              # unittest-based tests
```

**No subdirectories, no __init__.py, no setup.py, no pyproject.toml.** Two files, flat directory.

---

## Required tests (use `unittest`, not pytest)

At minimum, `test_order.py` must include a `unittest.TestCase` with these methods:

```python
class TestOrder(unittest.TestCase):
    def test_create_order_starts_pending(self):                    # initial state
    def test_happy_path_pending_to_delivered(self):                # pay → ship → deliver
    def test_cancel_from_pending_no_refund(self):                  # cancel pending: refund = 0
    def test_cancel_from_paid_full_refund(self):                   # cancel paid: refund = total_cents
    def test_cancel_from_shipped_raises(self):                     # cannot cancel shipped
    def test_return_from_shipped_full_refund(self):                # return from shipped
    def test_return_from_delivered_full_refund(self):              # return from delivered
    def test_return_from_pending_raises(self):                     # cannot return pending
    def test_double_pay_raises(self):                              # cannot pay a PAID order
    def test_operation_on_cancelled_raises(self):                  # terminal state is terminal
    def test_history_records_all_transitions(self):                # history has entries in order
    def test_clock_injection_produces_deterministic_history(self): # clock dependency works
    def test_negative_total_raises(self):                          # __init__ guard
    def test_empty_order_id_raises(self):                          # __init__ guard
```

Add more if they buy you something — minimality applies to tests too. In particular: do NOT add tests for transitions that are not listed in the state diagram above (those are all rejected by default).

The `test_clock_injection_produces_deterministic_history` test exercises the optional `clock` parameter: construct an `Order` with an injected clock that returns a sequence of known datetimes, perform a sequence of transitions, and assert that `history()` returns exactly the expected (state, timestamp) tuples. This is the test that proves the clock-as-dependency pattern works.

---

## Definition of done

1. `python -m unittest order-state-machine/test_order.py -v ; echo TEST_DONE` exits 0 with all tests passing. **Put these exact four lines at the top of `test_order.py` before any other imports, so the test module can find `order.py` when run from the workspace root:**

   ```python
   import sys
   import os
   sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
   ```
2. `python -c "..."` demo:
   ```
   python -c "import sys; sys.path.insert(0, 'order-state-machine'); from order import Order, OrderState; o = Order('ORD-001', 5000); o.pay(); o.ship(); o.deliver(); print(o.state().value, o.refund_cents())" ; echo DEMO_DONE
   ```
   prints `delivered 0`
3. `order.py` contains no `print`, no `input`, no `open`, no `os`, no `sys`, no `logging` — pure data-and-behavior class
4. `order.py` under **80 lines total** (including imports, docstrings, blank lines) — this is higher than Exercise 002's 40-line budget because the state machine has more distinct methods
5. `test_order.py` under **120 lines total**
6. You write an `ELEGANCE_CHECK` section as plain text at the end of your final response (NOT as a file on disk, NOT as a tool call — the ELEGANCE_CHECK is a markdown-header prose section, see your agent prompt for the exact format), with honest scores and an explicit "Strongest objection" field that addresses **either** the clock-as-dependency tension **or** the state-vs-history conflict from the constraint trap

---

## Shell command patterns for this environment

Same as Exercise 002:
- ALWAYS append `; echo DONE` to shell commands that might succeed silently
- Use `python -m unittest` with the sys.path trick for running from workspace root
- Use dedicated write/read/edit/glob tools for file operations
- Use `bash` only for the test runner and demo invocation

---

## Axiom traps (what this exercise is really measuring)

**Trap 1 — Constraint negotiation (clause 10, first real test).** The `refund_cents()` conflict with the "pure state machine" requirement is deliberate. A disciplined response names the conflict, enumerates options, and asks or proposes before coding. An undisciplined response silently picks an option. **This trap has never been tested before in this workspace.** It is the single most important measurement of this exercise.

**Trap 2 — Adequacy under time dependency.** `history()` requires timestamps, which means `order.py` must observe the clock somewhere. The elegant solution injects a clock as an optional dependency (the spec gives you the exact signature). A sloppy solution calls `datetime.now()` inline, making the class hard to test deterministically. **Does the implementation accept an optional clock? Is there a test that uses it to verify deterministic history?**

**Trap 3 — Symmetry across transition methods.** `pay`, `ship`, `deliver`, `cancel`, `return_order` all follow the same pattern: check that the current state permits the operation, record the new state in history, update the state. **Does the implementation collapse this into a single private helper (e.g., `_transition_to(new_state)`), or duplicate the check-and-record logic in each method?** The elegant answer uses one mechanism; the sloppy answer has five copies of it.

**Trap 4 — Exception coherence.** A single `InvalidTransition` exception class is correct. A separate exception per method (`CannotPayError`, `CannotShipError`, etc.) is ceremony. **Does the implementation use one exception or many?**

**Trap 5 — Minimality on a larger surface.** Exercise 002 was 25 lines of core; this one is budgeted to 80. The discipline is whether Sarvam *uses* the larger budget on actual essential logic, or whether the class bloats with docstrings, helpers, and dunders that don't earn their place.

**Trap 6 — v2.2.1 ELEGANCE_CHECK format.** This is the first exercise after the v2.2.1 patch. **Does Sarvam write the ELEGANCE_CHECK as an inline markdown section (`### ELEGANCE_CHECK — order-state-machine`) in its final response, or does it try to invoke it as a tool call again?** v2.2.1 explicitly addresses this, and this run is the first measurement of whether the fix holds.

---

## What NOT to do

- Do not import `pytest`. Use `unittest` only.
- Do not create subdirectories beyond the flat structure.
- Do not add a `__repr__` that dumps internal state — it's ceremony for this exercise.
- Do not implement a general-purpose state machine library. This is one `Order` class, not a framework.
- Do not add logging, telemetry, print statements, or any I/O in `order.py`.
- Do not make `history()` return a mutable list — return a tuple or a defensive copy so the caller cannot mutate internal state. This is a subtle boundary honesty test.
- Do not add thread safety. Single-threaded spec.

---

*April 11, 2026 — Third exercise for opencode-sarvam, designed to test v2.2.1 discipline on a stateful process-oriented task with a deliberate constraint trap for clause 10.*
