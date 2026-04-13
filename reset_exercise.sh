#!/bin/bash
# Reset an exercise codebase to its buggy state for A/B testing.
# Usage: bash reset_exercise.sh [007|008|009]

EXERCISE=$1

if [ -z "$EXERCISE" ]; then
    echo "Usage: bash reset_exercise.sh [007|008|009]"
    echo "  007 = sales-report (3 bugs)"
    echo "  008 = todo-api (5 bugs)"
    echo "  009 = expense-tracker (7 bugs)"
    exit 1
fi

case $EXERCISE in
    007)
        echo "Resetting sales-report to buggy state..."
        git checkout -- sales-report/sales_report.py
        echo "Done. Run: test_runner(directory='sales-report', module='test_sales_report')"
        ;;
    008)
        echo "Resetting todo-api to buggy state..."
        git checkout -- todo-api/todo_core.py todo-api/todo_helpers.py
        echo "Done. Run: test_runner(directory='todo-api', module='test_todo')"
        ;;
    009)
        echo "Resetting expense-tracker to buggy state..."
        git checkout -- expense-tracker/expense_core.py expense-tracker/expense_validators.py expense-tracker/expense_formatters.py
        echo "Done. Run: test_runner(directory='expense-tracker', module='test_expense')"
        ;;
    *)
        echo "Unknown exercise: $EXERCISE"
        exit 1
        ;;
esac
