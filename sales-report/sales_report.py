"""Sales report processing - pure core functions."""

from typing import Dict, List, Tuple
import csv
from io import StringIO


def parse_sales_rows(csv_content: str) -> List[Tuple[str, str, str, int]]:
    """Parse CSV content into (date, category, product, amount_cents) tuples.

    Args:
        csv_content: CSV content as string

    Returns:
        List of tuples with amount converted to integer cents

    Raises:
        ValueError: If amount cannot be parsed as number
        csv.Error: If CSV parsing fails
    """
    rows = []
    reader = csv.reader(StringIO(csv_content))

    # Skip header row
    next(reader, None)

    for row_num, row in enumerate(reader, start=2):  # start=2 for line numbers
        if not row or len(row) < 4:
            continue

        date, category, product, amount_str = row[:4]

        try:
            # Convert to cents (integer) to avoid float precision issues
            amount = int(float(amount_str))
        except ValueError as e:
            raise ValueError(f"Invalid amount '{amount_str}' at line {row_num}") from e

        rows.append((date, category, product, amount))

    return rows


def aggregate_by_month_and_category(rows: List[Tuple[str, str, str, int]]) -> Dict[str, Dict[str, int]]:
    """Aggregate sales amounts by month and category.

    Args:
        rows: List of (date, category, product, amount_cents) tuples

    Returns:
        Nested dict: {month: {category: total_cents}}
    """
    aggregated: Dict[str, Dict[str, int]] = {}

    for date, category, _, amount in rows:
        month = date.split('-')[1]  # Extract month from YYYY-MM-DD

        if month not in aggregated:
            aggregated[month] = {}

        aggregated[month][category] = amount

    return aggregated


def format_report(aggregated: Dict[str, Dict[str, int]]) -> str:
    """Format aggregated data into the required report format.

    Args:
        aggregated: Nested dict of aggregated sales data

    Returns:
        Formatted report string
    """
    lines = []

    # Sort months ascending
    months = sorted(aggregated.keys())

    for month in months:
        lines.append(f"Month: {month}")

        # Sort categories within each month
        categories = sorted(aggregated[month].keys())

        for category in categories:
            amount_cents = aggregated[month][category]
            # Convert back to dollars with 2 decimal places
            amount_dollars = amount_cents / 100
            formatted_amount = f"{amount_dollars:.2f}"
            lines.append(f"  {category}: {formatted_amount}")

    return "\n".join(lines)