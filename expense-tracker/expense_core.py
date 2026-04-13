"""Expense tracker — pure core functions.

All functions are pure: data in, data out, no side effects.
The boundary layer (cli.py) handles I/O and persistence.
"""

from expense_validators import validate_amount, validate_category, validate_date, parse_month


def add_expense(
    expenses: list,
    date: str,
    category: str,
    amount,
    description: str = "",
) -> tuple:
    """Add a new expense to the list.

    Args:
        expenses: Current list of expense dicts.
        date: Date string in YYYY-MM-DD format.
        category: Expense category (validated against VALID_CATEGORIES).
        amount: Amount in dollars (int, float, or string).
        description: Optional description.

    Returns:
        (updated_list, new_expense) tuple.

    Raises:
        ValueError: If date, category, or amount is invalid.
    """
    validated_date = validate_date(date)
    validated_category = validate_category(category)
    amount_cents = validate_amount(amount)

    new_expense = {
        "id": len(expenses) + 1,
        "date": validated_date,
        "category": validated_category,
        "amount_cents": amount_cents,
        "description": description,
    }

    return expenses + [new_expense], new_expense


def monthly_summary(expenses: list, month: str) -> dict:
    """Compute summary statistics for a given month.

    Args:
        expenses: List of expense dicts.
        month: Month string in YYYY-MM format.

    Returns:
        Dict with keys: month, total_cents, count, by_category.
        by_category maps category -> {"total_cents": N, "count": N}.
    """
    month_expenses = [e for e in expenses if parse_month(e["date"]) == month]

    by_category = {}
    total_cents = 0

    for e in month_expenses:
        cat = e["category"]
        cents = e["amount_cents"]

        if cat not in by_category:
            by_category[cat] = {"total_cents": 0, "count": 0}
        by_category[cat]["total_cents"] += cents
        by_category[cat]["count"] += 1

        total_cents += cents

    return {
        "month": month,
        "total_cents": total_cents,
        "count": len(month_expenses),
        "by_category": by_category,
    }


def filter_expenses(
    expenses: list,
    category: str = None,
    min_amount_cents: int = None,
    max_amount_cents: int = None,
    month: str = None,
) -> list:
    """Filter expenses by various criteria. All filters combine with AND logic.

    Args:
        expenses: List of expense dicts.
        category: Optional category filter (case-insensitive).
        min_amount_cents: Optional minimum amount in cents (inclusive).
        max_amount_cents: Optional maximum amount in cents (inclusive).
        month: Optional month filter in YYYY-MM format.

    Returns:
        Filtered list of expense dicts.
    """
    result = expenses

    if category is not None:
        cat_lower = category.strip().lower()
        result = [e for e in result if e["category"] == cat_lower]

    if min_amount_cents is not None:
        result = [e for e in result if e["amount_cents"] >= min_amount_cents]

    if max_amount_cents is not None:
        result = [e for e in result if e["amount_cents"] <= max_amount_cents]

    if month is not None:
        result = [e for e in result if parse_month(e["date"]) == month]

    return result


def check_budget(
    expenses: list,
    budgets: dict,
    month: str,
) -> list:
    """Check spending against budgets for a given month.

    Args:
        expenses: List of expense dicts.
        budgets: Dict mapping category -> budget in cents.
        month: Month string in YYYY-MM format.

    Returns:
        List of dicts: [{"category": str, "spent_cents": int,
                         "budget_cents": int, "over": bool}]
        Sorted by category name. Only includes categories that have a budget.
    """
    summary = monthly_summary(expenses, month)

    results = []
    for cat, budget_cents in sorted(budgets.items()):
        cat_data = summary["by_category"].get(cat, {"total_cents": 0})
        spent = cat_data["total_cents"]
        results.append({
            "category": cat,
            "spent_cents": spent,
            "budget_cents": budget_cents,
            "over": spent > budget_cents,
        })

    return results


def top_expenses(expenses: list, n: int = 5, month: str = None) -> list:
    """Return the top N expenses by amount.

    Args:
        expenses: List of expense dicts.
        n: Number of top expenses to return (default 5).
        month: Optional month filter in YYYY-MM format.

    Returns:
        List of up to N expense dicts, sorted by amount_cents descending.
    """
    filtered = expenses
    if month is not None:
        filtered = [e for e in filtered if parse_month(e["date"]) == month]

    sorted_expenses = sorted(filtered, key=lambda e: e["amount_cents"], reverse=True)
    return sorted_expenses[:n]


def category_trend(expenses: list, category: str) -> list:
    """Compute monthly spending trend for a category.

    Args:
        expenses: List of expense dicts.
        category: Category to track (case-insensitive).

    Returns:
        List of {"month": str, "total_cents": int} dicts, sorted by month ascending.
        Only includes months that have at least one expense in that category.
    """
    cat_lower = category.strip().lower()
    cat_expenses = [e for e in expenses if e["category"] == cat_lower]

    monthly = {}
    for e in cat_expenses:
        m = parse_month(e["date"])
        monthly[m] = monthly.get(m, 0) + e["amount_cents"]

    return [
        {"month": m, "total_cents": monthly[m]}
        for m in sorted(monthly.keys())
    ]
