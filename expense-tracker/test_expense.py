"""Unit tests for the expense tracker pure core."""

import unittest
from expense_core import (
    add_expense,
    monthly_summary,
    filter_expenses,
    check_budget,
    top_expenses,
    category_trend,
)
from expense_validators import validate_amount, validate_category, validate_date
from expense_formatters import format_cents, format_expense_line, format_budget_status


# --- Shared fixtures ---

def make_sample_expenses():
    """Create a standard set of test expenses."""
    expenses = []
    expenses, _ = add_expense(expenses, "2026-01-05", "food", 15.99, "Lunch")
    expenses, _ = add_expense(expenses, "2026-01-12", "transport", 25.00, "Taxi")
    expenses, _ = add_expense(expenses, "2026-01-20", "food", 42.50, "Dinner")
    expenses, _ = add_expense(expenses, "2026-02-03", "utilities", 89.99, "Electric bill")
    expenses, _ = add_expense(expenses, "2026-02-15", "food", 12.00, "Coffee")
    expenses, _ = add_expense(expenses, "2026-02-20", "entertainment", 35.00, "Movie tickets")
    return expenses


class TestValidators(unittest.TestCase):
    def test_validate_amount_from_float(self):
        """Float amounts are converted to integer cents."""
        self.assertEqual(validate_amount(15.99), 1599)

    def test_validate_amount_from_string(self):
        """String amounts are parsed and converted."""
        self.assertEqual(validate_amount("25.00"), 2500)

    def test_validate_amount_rounds_correctly(self):
        """Amounts with floating-point imprecision are rounded, not truncated.

        0.29 * 100 = 28.999...96 in IEEE 754. round() gives 29, int() gives 28.
        """
        self.assertEqual(validate_amount(0.29), 29)
        self.assertEqual(validate_amount(1.15), 115)

    def test_validate_amount_negative_raises(self):
        """Negative amounts raise ValueError."""
        with self.assertRaises(ValueError):
            validate_amount(-5.00)

    def test_validate_category_case_insensitive(self):
        """Categories are normalized to lowercase."""
        self.assertEqual(validate_category("FOOD"), "food")
        self.assertEqual(validate_category("Transport"), "transport")

    def test_validate_date_format(self):
        """Valid dates are accepted and normalized."""
        self.assertEqual(validate_date("2026-01-05"), "2026-01-05")

    def test_validate_date_invalid_raises(self):
        """Invalid date formats raise ValueError."""
        with self.assertRaises(ValueError):
            validate_date("01/05/2026")


class TestAddExpense(unittest.TestCase):
    def test_add_first_expense(self):
        """First expense gets id=1 and correct fields."""
        expenses, item = add_expense([], "2026-01-05", "food", 15.99, "Lunch")
        self.assertEqual(item["id"], 1)
        self.assertEqual(item["amount_cents"], 1599)
        self.assertEqual(item["category"], "food")
        self.assertEqual(len(expenses), 1)

    def test_add_preserves_existing(self):
        """Adding expense doesn't mutate original list."""
        original = []
        new_list, _ = add_expense(original, "2026-01-05", "food", 10.00)
        self.assertEqual(len(original), 0)
        self.assertEqual(len(new_list), 1)

    def test_add_increments_id(self):
        """IDs increment correctly."""
        expenses, _ = add_expense([], "2026-01-05", "food", 10.00)
        expenses, item = add_expense(expenses, "2026-01-06", "food", 20.00)
        self.assertEqual(item["id"], 2)


class TestMonthlySummary(unittest.TestCase):
    def test_summary_totals(self):
        """Monthly summary computes correct totals."""
        expenses = make_sample_expenses()
        summary = monthly_summary(expenses, "2026-01")
        # food: 1599 + 4250 = 5849, transport: 2500 -> total = 8349
        self.assertEqual(summary["total_cents"], 8349)
        self.assertEqual(summary["count"], 3)

    def test_summary_by_category(self):
        """Monthly summary breaks down by category."""
        expenses = make_sample_expenses()
        summary = monthly_summary(expenses, "2026-01")
        self.assertEqual(summary["by_category"]["food"]["total_cents"], 5849)
        self.assertEqual(summary["by_category"]["food"]["count"], 2)
        self.assertEqual(summary["by_category"]["transport"]["total_cents"], 2500)

    def test_summary_accumulates_not_overwrites(self):
        """Multiple expenses in same category are summed, not overwritten."""
        expenses = []
        expenses, _ = add_expense(expenses, "2026-03-01", "food", 10.00)
        expenses, _ = add_expense(expenses, "2026-03-15", "food", 20.00)
        expenses, _ = add_expense(expenses, "2026-03-25", "food", 30.00)
        summary = monthly_summary(expenses, "2026-03")
        self.assertEqual(summary["by_category"]["food"]["total_cents"], 6000)
        self.assertEqual(summary["total_cents"], 6000)

    def test_summary_empty_month(self):
        """Summary for a month with no expenses returns zeros."""
        expenses = make_sample_expenses()
        summary = monthly_summary(expenses, "2026-06")
        self.assertEqual(summary["total_cents"], 0)
        self.assertEqual(summary["count"], 0)
        self.assertEqual(summary["by_category"], {})


class TestFilterExpenses(unittest.TestCase):
    def test_filter_by_category(self):
        """Filter by category returns matching expenses."""
        expenses = make_sample_expenses()
        food = filter_expenses(expenses, category="food")
        self.assertEqual(len(food), 3)
        for e in food:
            self.assertEqual(e["category"], "food")

    def test_filter_by_max_amount_inclusive(self):
        """Max amount filter is inclusive (<=, not <)."""
        expenses = make_sample_expenses()
        # 2500 cents = $25.00 (the taxi). Should be INCLUDED.
        result = filter_expenses(expenses, max_amount_cents=2500)
        amounts = [e["amount_cents"] for e in result]
        self.assertIn(2500, amounts)

    def test_filter_by_month(self):
        """Filter by month returns only that month's expenses."""
        expenses = make_sample_expenses()
        jan = filter_expenses(expenses, month="2026-01")
        self.assertEqual(len(jan), 3)

    def test_filter_combined(self):
        """Multiple filters combine with AND."""
        expenses = make_sample_expenses()
        result = filter_expenses(expenses, category="food", month="2026-01")
        self.assertEqual(len(result), 2)


class TestCheckBudget(unittest.TestCase):
    def test_under_budget(self):
        """Category under budget shows over=False."""
        expenses = make_sample_expenses()
        budgets = {"food": 10000}  # $100 budget
        statuses = check_budget(expenses, budgets, "2026-01")
        food_status = statuses[0]
        self.assertEqual(food_status["spent_cents"], 5849)
        self.assertFalse(food_status["over"])

    def test_exactly_at_budget_is_not_over(self):
        """Spending exactly the budget amount is NOT over budget.

        over should be True only when spent > budget, not >=.
        """
        expenses = []
        expenses, _ = add_expense(expenses, "2026-01-05", "food", 50.00)
        budgets = {"food": 5000}  # $50 budget, spent exactly $50
        statuses = check_budget(expenses, budgets, "2026-01")
        self.assertFalse(statuses[0]["over"])

    def test_over_budget(self):
        """Category over budget shows over=True."""
        expenses = make_sample_expenses()
        budgets = {"food": 2000}  # $20 budget, but spent $58.49
        statuses = check_budget(expenses, budgets, "2026-01")
        self.assertTrue(statuses[0]["over"])


class TestTopExpenses(unittest.TestCase):
    def test_top_3(self):
        """Top 3 returns the 3 most expensive items, descending."""
        expenses = make_sample_expenses()
        top = top_expenses(expenses, n=3)
        self.assertEqual(len(top), 3)
        # Should be sorted descending: 8999, 4250, 3500
        self.assertEqual(top[0]["amount_cents"], 8999)
        self.assertEqual(top[1]["amount_cents"], 4250)

    def test_top_by_month(self):
        """Top expenses filtered by month."""
        expenses = make_sample_expenses()
        top = top_expenses(expenses, n=2, month="2026-01")
        self.assertEqual(len(top), 2)
        # Only Jan expenses, sorted desc: 4250, 2500
        self.assertEqual(top[0]["amount_cents"], 4250)


class TestCategoryTrend(unittest.TestCase):
    def test_trend_across_months(self):
        """Trend shows monthly totals sorted by month."""
        expenses = make_sample_expenses()
        trend = category_trend(expenses, "food")
        self.assertEqual(len(trend), 2)
        self.assertEqual(trend[0]["month"], "2026-01")
        self.assertEqual(trend[0]["total_cents"], 5849)
        self.assertEqual(trend[1]["month"], "2026-02")
        self.assertEqual(trend[1]["total_cents"], 1200)


class TestFormatters(unittest.TestCase):
    def test_format_cents(self):
        """Cents are formatted as dollar strings."""
        self.assertEqual(format_cents(1599), "$15.99")
        self.assertEqual(format_cents(0), "$0.00")
        self.assertEqual(format_cents(100), "$1.00")

    def test_format_budget_under(self):
        """Under-budget formatting shows percentage."""
        result = format_budget_status("food", 5000, 10000)
        self.assertEqual(result, "food: $50.00 / $100.00 (50.0% used)")

    def test_format_budget_exactly_at(self):
        """At-budget formatting shows 100% used, NOT over budget.

        Spending exactly the budget is <= budget, so shows percentage.
        """
        result = format_budget_status("food", 10000, 10000)
        self.assertEqual(result, "food: $100.00 / $100.00 (100.0% used)")

    def test_format_budget_over(self):
        """Over-budget formatting shows overage."""
        result = format_budget_status("food", 12000, 10000)
        self.assertEqual(result, "food: $120.00 / $100.00 (OVER BUDGET by $20.00)")


if __name__ == "__main__":
    unittest.main()
