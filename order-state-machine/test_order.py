import unittest
import sys
from datetime import datetime, timezone, timedelta
from order import Order, OrderState, InvalidTransition


class TestOrder(unittest.TestCase):
    def test_create_order_starts_pending(self):
        order = Order("ORD-001", 5000)
        self.assertEqual(order.state(), OrderState.PENDING)

    def test_happy_path_pending_to_delivered(self):
        order = Order("ORD-001", 5000)
        order.pay()
        self.assertEqual(order.state(), OrderState.PAID)
        order.ship()
        self.assertEqual(order.state(), OrderState.SHIPPED)
        order.deliver()
        self.assertEqual(order.state(), OrderState.DELIVERED)

    def test_cancel_from_pending_no_refund(self):
        order = Order("ORD-001", 5000)
        order.cancel()
        self.assertEqual(order.state(), OrderState.CANCELLED)
        self.assertEqual(order.refund_cents(), 0)

    def test_cancel_from_paid_full_refund(self):
        order = Order("ORD-001", 5000)
        order.pay()
        order.cancel()
        self.assertEqual(order.state(), OrderState.CANCELLED)
        self.assertEqual(order.refund_cents(), 5000)

    def test_cancel_from_shipped_raises(self):
        order = Order("ORD-001", 5000)
        order.pay()
        order.ship()
        with self.assertRaises(InvalidTransition):
            order.cancel()

    def test_return_from_shipped_full_refund(self):
        order = Order("ORD-001", 5000)
        order.pay()
        order.ship()
        order.return_order()
        self.assertEqual(order.state(), OrderState.RETURNED)
        self.assertEqual(order.refund_cents(), 5000)

    def test_return_from_delivered_full_refund(self):
        order = Order("ORD-001", 5000)
        order.pay()
        order.ship()
        order.deliver()
        order.return_order()
        self.assertEqual(order.state(), OrderState.RETURNED)
        self.assertEqual(order.refund_cents(), 5000)

    def test_return_from_pending_raises(self):
        order = Order("ORD-001", 5000)
        with self.assertRaises(InvalidTransition):
            order.return_order()

    def test_double_pay_raises(self):
        order = Order("ORD-001", 5000)
        order.pay()
        with self.assertRaises(InvalidTransition):
            order.pay()

    def test_operation_on_cancelled_raises(self):
        order = Order("ORD-001", 5000)
        order.pay()
        order.cancel()
        with self.assertRaises(InvalidTransition):
            order.ship()
        with self.assertRaises(InvalidTransition):
            order.deliver()
        with self.assertRaises(InvalidTransition):
            order.return_order()

    def test_history_records_all_transitions(self):
        order = Order("ORD-001", 5000)
        initial_time = order.history()[0][1]
        order.pay()
        paid_time = order.history()[1][1]
        order.ship()
        shipped_time = order.history()[2][1]
        order.deliver()
        delivered_time = order.history()[3][1]

        self.assertEqual(order.history()[0][0], OrderState.PENDING)
        self.assertEqual(order.history()[1][0], OrderState.PAID)
        self.assertEqual(order.history()[2][0], OrderState.SHIPPED)
        self.assertEqual(order.history()[3][0], OrderState.DELIVERED)
        self.assertGreaterEqual(paid_time, initial_time)
        self.assertGreaterEqual(shipped_time, paid_time)
        self.assertGreaterEqual(delivered_time, shipped_time)

    def test_clock_injection_produces_deterministic_history(self):
        expected_times = [
            datetime(2023, 1, 1, 10, 0, 0, tzinfo=timezone.utc),
            datetime(2023, 1, 1, 11, 0, 0, tzinfo=timezone.utc),
            datetime(2023, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
            datetime(2023, 1, 1, 13, 0, 0, tzinfo=timezone.utc),
        ]

        times = expected_times.copy()
        clock = lambda: times.pop(0)
        order = Order("ORD-001", 5000, clock)

        order.pay()
        order.ship()
        order.deliver()

        expected = [
            (OrderState.PENDING, expected_times[0]),
            (OrderState.PAID, expected_times[1]),
            (OrderState.SHIPPED, expected_times[2]),
            (OrderState.DELIVERED, expected_times[3]),
        ]

        self.assertEqual(order.history(), expected)

    def test_negative_total_raises(self):
        with self.assertRaises(ValueError):
            Order("ORD-001", -100)

    def test_empty_order_id_raises(self):
        with self.assertRaises(ValueError):
            Order("", 5000)

    def test_demo_output(self):
        order = Order("ORD-001", 5000)
        order.pay()
        order.ship()
        order.deliver()
        self.assertEqual(order.state().value, "delivered")
        self.assertEqual(order.refund_cents(), 0)


if __name__ == "__main__":
    unittest.main()