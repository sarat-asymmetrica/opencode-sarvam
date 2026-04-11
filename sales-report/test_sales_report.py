"""Unit tests for sales report processing."""

import unittest
from sales_report import parse_sales_rows, aggregate_by_month_and_category, format_report


class TestParse(unittest.TestCase):
    def test_parses_simple_rows(self):
        """Test parsing basic CSV rows without special characters."""
        csv_content = """date,category,product,amount
2026-01-05,books,Rust in Action,39.99
2026-01-12,electronics,USB-C hub,24.50
"""
        rows = parse_sales_rows(csv_content)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0], ('2026-01-05', 'books', 'Rust in Action', 3999))
        self.assertEqual(rows[1], ('2026-01-12', 'electronics', 'USB-C hub', 2450))

    def test_handles_quoted_cells(self):
        """Test parsing CSV with quoted commas in fields."""
        csv_content = '''date,category,product,amount
2026-02-03,electronics,"Keyboard, mechanical",89.99
'''
        rows = parse_sales_rows(csv_content)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0], ('2026-02-03', 'electronics', 'Keyboard, mechanical', 8999))

    def test_skips_header_row(self):
        """Test that header row is skipped during parsing."""
        csv_content = """date,category,product,amount
2026-01-05,books,Rust in Action,39.99
"""
        rows = parse_sales_rows(csv_content)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0][0], '2026-01-05')

    def test_skips_empty_lines(self):
        """Test that empty lines are ignored during parsing."""
        csv_content = """date,category,product,amount

2026-01-05,books,Rust in Action,39.99

2026-01-12,electronics,USB-C hub,24.50
"""
        rows = parse_sales_rows(csv_content)
        self.assertEqual(len(rows), 2)

    def test_rejects_malformed_amount(self):
        """Test that non-numeric amounts raise ValueError."""
        csv_content = """date,category,product,amount
2026-01-05,books,Rust in Action,invalid
"""
        with self.assertRaises(ValueError) as cm:
            parse_sales_rows(csv_content)
        self.assertIn("Invalid amount 'invalid'", str(cm.exception))

    def test_rejects_insufficient_columns(self):
        """Test that rows with too few columns are skipped."""
        csv_content = """date,category,product,amount
2026-01-05,books
2026-01-12,electronics,USB-C hub,24.50
"""
        rows = parse_sales_rows(csv_content)
        self.assertEqual(len(rows), 1)  # Only the complete row is parsed


class TestAggregation(unittest.TestCase):
    def test_aggregates_by_month_and_category(self):
        """Test basic aggregation by month and category."""
        rows = [
            ('2026-01-05', 'books', 'Rust in Action', 3999),
            ('2026-01-12', 'books', 'Python Distilled', 3200),
            ('2026-02-03', 'electronics', 'USB-C hub', 2450),
        ]
        result = aggregate_by_month_and_category(rows)

        expected = {
            '01': {'books': 7199},
            '02': {'electronics': 2450}
        }
        self.assertEqual(result, expected)

    def test_sums_multiple_sales_same_category(self):
        """Test summing multiple sales in the same category."""
        rows = [
            ('2026-01-05', 'books', 'Rust in Action', 3999),
            ('2026-01-18', 'books', 'Python Distilled', 3200),
            ('2026-01-25', 'books', 'Crafting Interpreters', 4200),
        ]
        result = aggregate_by_month_and_category(rows)

        expected = {
            '01': {'books': 11399}
        }
        self.assertEqual(result, expected)

    def test_empty_input_returns_empty(self):
        """Test that empty input returns empty aggregation."""
        result = aggregate_by_month_and_category([])
        self.assertEqual(result, {})

    def test_multiple_categories_same_month(self):
        """Test multiple categories within the same month."""
        rows = [
            ('2026-01-05', 'books', 'Rust in Action', 3999),
            ('2026-01-12', 'electronics', 'USB-C hub', 2450),
            ('2026-01-20', 'clothing', 'T-shirt', 1599),
        ]
        result = aggregate_by_month_and_category(rows)

        expected = {
            '01': {
                'books': 3999,
                'clothing': 1599,
                'electronics': 2450
            }
        }
        self.assertEqual(result, expected)


class TestFormatting(unittest.TestCase):
    def test_format_matches_sample_output(self):
        """Test that formatting matches the exact expected output format."""
        aggregated = {
            '01': {
                'books': 7199,
                'clothing': 1599,
                'electronics': 2450
            },
            '02': {
                'books': 4200,
                'clothing': 5500,
                'electronics': 8999
            }
        }
        result = format_report(aggregated)
        expected = """Month: 01
  books: $71.99
  clothing: $15.99
  electronics: $24.50
Month: 02
  books: $42.00
  clothing: $55.00
  electronics: $89.99"""
        self.assertEqual(result, expected)

    def test_sorts_months_ascending(self):
        """Test that months are sorted in ascending order."""
        aggregated = {
            '12': {'books': 1000},
            '01': {'books': 1000},
            '06': {'books': 1000},
        }
        result = format_report(aggregated)
        lines = result.split('\n')

        # Check that months appear in order: 01, 06, 12
        month_lines = [line for line in lines if line.startswith('Month:')]
        self.assertEqual(month_lines[0], 'Month: 01')
        self.assertEqual(month_lines[1], 'Month: 06')
        self.assertEqual(month_lines[2], 'Month: 12')

    def test_sorts_categories_within_month(self):
        """Test that categories are sorted alphabetically within each month."""
        aggregated = {
            '01': {
                'zebra': 1000,
                'apple': 1000,
                'banana': 1000,
            }
        }
        result = format_report(aggregated)
        lines = result.split('\n')

        # Check category order: apple, banana, zebra
        category_lines = [line for line in lines if line.startswith('  ') and ':' in line]
        self.assertEqual(category_lines[0], '  apple: $10.00')
        self.assertEqual(category_lines[1], '  banana: $10.00')
        self.assertEqual(category_lines[2], '  zebra: $10.00')

    def test_format_empty_aggregation(self):
        """Test formatting empty aggregation."""
        result = format_report({})
        self.assertEqual(result, '')


if __name__ == '__main__':
    unittest.main()