"""Helper functions for the todo API pure core."""


def validate_priority(priority: str) -> str:
    """Validate and normalize priority string.

    Accepts "low", "medium", "high" (case-insensitive).
    Returns lowercase normalized form.

    Raises:
        ValueError: If priority is not one of the valid values.
    """
    normalized = priority.strip().lower()
    if normalized not in ("low", "medium", "high"):
        raise ValueError(
            f"Invalid priority '{priority}'. Must be one of: low, medium, high"
        )
    return normalized


def generate_id(todos: list) -> int:
    """Generate the next unique ID for a todo item.

    Returns max(existing IDs) + 1, or 1 if the list is empty.
    """
    if not todos:
        return 1
    return max(t["id"] for t in todos) + 1


def format_todo_line(todo: dict) -> str:
    """Format a single todo for display.

    Format: "[X] #3 (high) Buy groceries"  (completed)
            "[ ] #3 (high) Buy groceries"  (active)
    """
    checkbox = "[ ]" if todo.get("completed", False) else "[X]"
    return f'{checkbox} #{todo["id"]} ({todo["priority"]}) {todo["title"]}'


def format_todo_list(todos: list) -> str:
    """Format multiple todos, one per line.

    Sorted by priority (high > medium > low), then by id within each priority.
    """
    priority_order = {"high": 0, "medium": 1, "low": 2}
    sorted_todos = sorted(
        todos,
        key=lambda t: (priority_order.get(t["priority"], 99), t["id"]),
    )
    return "\n".join(format_todo_line(t) for t in sorted_todos)
