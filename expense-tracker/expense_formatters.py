"""Formatting functions for the expense tracker."""


def format_cents(amount_cents: int) -> str:
    """Format integer cents as a dollar string with 2 decimal places.

    Examples:
        format_cents(1599) -> "$15.99"
        format_cents(0) -> "$0.00"
        format_cents(100) -> "$1.00"
    """
    dollars = amount_cents / 100
    return f"${dollars:.2f}"


def format_expense_line(expense: dict) -> str:
    """Format a single expense for display.

    Format: "2026-01-15  food      $15.99  Lunch at cafe"
    Fields are padded for alignment.
    """
    date = expense["date"]
    category = expense["category"].ljust(12)
    amount = format_cents(expense["amount_cents"]).rjust(10)
    description = expense.get("description", "")
    return f"{date}  {category}{amount}  {description}"


def format_monthly_summary(summary: dict) -> str:
    """Format a monthly summary for display.

    Input: {"month": "2026-01", "total_cents": 15000, "by_category": {...}, "count": 5}
    Output:
        === 2026-01 ===
        food:         $50.00 (3 items)
        transport:    $25.00 (2 items)
        ---
        Total: $75.00 (5 items)
    """
    lines = [f"=== {summary['month']} ==="]

    for cat, data in sorted(summary["by_category"].items()):
        cat_padded = (cat + ":").ljust(14)
        amount = format_cents(data["total_cents"])
        count = data["count"]
        lines.append(f"  {cat_padded}{amount} ({count} items)")

    lines.append("  ---")
    total = format_cents(summary["total_cents"])
    lines.append(f"  Total: {total} ({summary['count']} items)")

    return "\n".join(lines)


def format_budget_status(category: str, spent_cents: int, budget_cents: int) -> str:
    """Format budget status for a category.

    Returns one of:
        "food: $50.00 / $100.00 (50.0% used)"
        "food: $120.00 / $100.00 (OVER BUDGET by $20.00)"
    """
    spent = format_cents(spent_cents)
    budget = format_cents(budget_cents)

    if spent_cents <= budget_cents:
        pct = (spent_cents / budget_cents * 100) if budget_cents > 0 else 0.0
        return f"{category}: {spent} / {budget} ({pct:.1f}% used)"
    else:
        over = format_cents(spent_cents - budget_cents)
        return f"{category}: {spent} / {budget} (OVER BUDGET by {over})"
