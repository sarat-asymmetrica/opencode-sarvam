"""Validation helpers for the expense tracker."""

from datetime import datetime

VALID_CATEGORIES = frozenset([
    "food", "transport", "utilities", "entertainment",
    "health", "education", "shopping", "other",
])


def validate_amount(amount) -> int:
    """Validate and convert amount to integer cents.

    Accepts int, float, or string representations.
    Returns amount in cents (integer).

    Raises:
        ValueError: If amount is negative or not a valid number.
        TypeError: If amount is not a supported type.
    """
    if isinstance(amount, str):
        try:
            amount = float(amount)
        except ValueError:
            raise ValueError(f"Cannot parse amount: '{amount}'")

    if not isinstance(amount, (int, float)):
        raise TypeError(f"Amount must be numeric, got {type(amount).__name__}")

    if amount < 0:
        raise ValueError(f"Amount cannot be negative: {amount}")

    return round(amount * 100)


def validate_category(category: str) -> str:
    """Validate and normalize expense category.

    Case-insensitive. Returns lowercase.

    Raises:
        ValueError: If category is not in the valid set.
    """
    normalized = category.strip().lower()
    if normalized not in VALID_CATEGORIES:
        raise ValueError(
            f"Invalid category '{category}'. Valid: {sorted(VALID_CATEGORIES)}"
        )
    return normalized


def validate_date(date_str: str) -> str:
    """Validate date string in YYYY-MM-DD format.

    Returns the validated date string.

    Raises:
        ValueError: If date format is invalid.
    """
    try:
        parsed = datetime.strptime(date_str, "%Y-%m-%d")
        return parsed.strftime("%Y-%m-%d")
    except ValueError:
        raise ValueError(
            f"Invalid date '{date_str}'. Expected format: YYYY-MM-DD"
        )


def parse_month(date_str: str) -> str:
    """Extract YYYY-MM from a YYYY-MM-DD date string."""
    return date_str[:7]
