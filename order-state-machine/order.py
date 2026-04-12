from datetime import datetime, timezone
from enum import Enum
from typing import Callable, List, Tuple, Optional


class OrderState(Enum):
    PENDING = "pending"
    PAID = "paid"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    RETURNED = "returned"


class InvalidTransition(Exception):
    """Raised when an operation is not legal from the current state."""


class Order:
    def __init__(self, order_id: str, total_cents: int, clock: Optional[Callable[[], datetime]] = None) -> None:
        if not order_id:
            raise ValueError("order_id cannot be empty")
        if total_cents < 0:
            raise ValueError("total_cents cannot be negative")

        self._order_id = order_id
        self._total_cents = total_cents
        self._clock = clock or (lambda: datetime.now(timezone.utc))
        self._state = OrderState.PENDING
        self._history: List[Tuple[OrderState, datetime]] = [(OrderState.PENDING, self._clock())]
        self._cancelled_from_paid = False

    def state(self) -> OrderState:
        return self._state

    def history(self) -> List[Tuple[OrderState, datetime]]:
        return self._history.copy()

    def _transition_to(self, new_state: OrderState) -> None:
        current_time = self._clock()
        self._history.append((new_state, current_time))
        self._state = new_state

    def pay(self) -> None:
        if self._state != OrderState.PENDING:
            raise InvalidTransition(f"Cannot pay from state {self._state.value}")
        self._transition_to(OrderState.PAID)

    def ship(self) -> None:
        if self._state != OrderState.PENDING:
            raise InvalidTransition(f"Cannot ship from state {self._state.value}")
        self._transition_to(OrderState.SHIPPED)

    def deliver(self) -> None:
        if self._state != OrderState.SHIPPED:
            raise InvalidTransition(f"Cannot deliver from state {self._state.value}")
        self._transition_to(OrderState.DELIVERED)

    def cancel(self) -> None:
        if self._state == OrderState.PENDING:
            self._transition_to(OrderState.CANCELLED)
            self._cancelled_from_paid = False
        elif self._state == OrderState.PAID:
            self._transition_to(OrderState.CANCELLED)
            self._cancelled_from_paid = True
        else:
            raise InvalidTransition(f"Cannot cancel from state {self._state.value}")

    def return_order(self) -> None:
        if self._state in [OrderState.PENDING, OrderState.PAID, OrderState.CANCELLED, OrderState.SHIPPED]:
            raise InvalidTransition(f"Cannot return from state {self._state.value}")
        self._transition_to(OrderState.RETURNED)

    def refund_cents(self) -> int:
        if self._state == OrderState.CANCELLED:
            return self._total_cents if not self._cancelled_from_paid else 0
        elif self._state == OrderState.RETURNED:
            return self._total_cents
        else:
            return 0