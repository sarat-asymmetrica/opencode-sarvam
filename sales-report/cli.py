"""CLI interface for sales report processing."""

import sys
from pathlib import Path
from typing import Optional

from sales_report import parse_sales_rows, aggregate_by_month_and_category, format_report


def main() -> Optional[int]:
    """Main CLI entry point.

    Returns:
        Exit code (0 for success, 1 for error)
    """
    if len(sys.argv) != 2:
        print("Usage: python cli.py <csv_file>", file=sys.stderr)
        return 1

    csv_file = sys.argv[1]

    try:
        # Read CSV file
        file_path = Path(csv_file)
        if not file_path.exists():
            print(f"Error: File '{csv_file}' not found", file=sys.stderr)
            return 1

        csv_content = file_path.read_text(encoding='utf-8')

        # Process data through pure core functions
        rows = parse_sales_rows(csv_content)
        aggregated = aggregate_by_month_and_category(rows)
        report = format_report(aggregated)

        # Print result
        print(report)

        return 0

    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"Unexpected error: {e}", file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())