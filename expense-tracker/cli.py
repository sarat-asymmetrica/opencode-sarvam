"""CLI boundary layer for the expense tracker.

DO NOT MODIFY — this is the boundary layer.
The pure core (expense_core.py) and helpers are the debugging targets.
"""

import json
from expense_core import add_expense, monthly_summary, check_budget
from expense_formatters import format_expense_line, format_monthly_summary, format_budget_status


def main():
    expenses = []

    expenses, _ = add_expense(expenses, "2026-01-05", "food", 15.99, "Lunch")
    expenses, _ = add_expense(expenses, "2026-01-12", "transport", 25.00, "Taxi")
    expenses, _ = add_expense(expenses, "2026-01-20", "food", 42.50, "Dinner")

    print("=== Expenses ===")
    for e in expenses:
        print(format_expense_line(e))

    summary = monthly_summary(expenses, "2026-01")
    print("\n" + format_monthly_summary(summary))

    budgets = {"food": 10000, "transport": 5000}
    statuses = check_budget(expenses, budgets, "2026-01")
    print("\n=== Budget Check ===")
    for s in statuses:
        print(format_budget_status(s["category"], s["spent_cents"], s["budget_cents"]))


if __name__ == "__main__":
    main()
