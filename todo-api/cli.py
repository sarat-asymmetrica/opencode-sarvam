"""CLI boundary layer for the todo API.

DO NOT MODIFY — this is the boundary layer.
The pure core (todo_core.py) is the target for debugging.
"""

import sys
import json
from todo_core import create_todo, complete_todo, filter_todos, summarize_todos
from todo_helpers import format_todo_list


def main():
    """Simple CLI for demonstration purposes."""
    todos = []

    # Create some sample todos
    todos, _ = create_todo(todos, "Buy groceries", "high")
    todos, _ = create_todo(todos, "Read a book", "low")
    todos, _ = create_todo(todos, "Write tests", "medium")

    print("=== All Todos ===")
    print(format_todo_list(todos))

    print("\n=== Summary ===")
    print(json.dumps(summarize_todos(todos), indent=2))

    # Complete the first todo
    todos, completed = complete_todo(todos, 1)
    print(f"\nCompleted: {completed['title']}")

    print("\n=== Active Todos ===")
    active = filter_todos(todos, status="active")
    print(format_todo_list(active))


if __name__ == "__main__":
    main()
