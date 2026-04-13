"""Todo API — pure core functions.

All functions are pure: they take data in, return data out, no side effects.
The boundary layer (cli.py) handles I/O.
"""

from datetime import datetime
from todo_helpers import validate_priority, generate_id


def create_todo(
    todos: list, title: str, priority: str = "medium"
) -> tuple:
    """Create a new todo item.

    Args:
        todos: Current list of todo dicts.
        title: Title for the new todo.
        priority: Priority level ("low", "medium", "high").

    Returns:
        (updated_list, new_item) — a new list with the item appended, and the item itself.

    Raises:
        ValueError: If priority is invalid.
    """
    validated_priority = validate_priority(priority)
    new_id = 1

    new_item = {
        "id": new_id,
        "title": title,
        "priority": validated_priority,
        "completed": False,
        "created_at": datetime.now().isoformat(),
        "completed_at": None,
    }

    return todos + [new_item], new_item


def complete_todo(todos: list, todo_id: int) -> tuple:
    """Mark a todo as completed.

    Args:
        todos: Current list of todo dicts.
        todo_id: ID of the todo to complete.

    Returns:
        (updated_list, completed_item) — new list with the item marked completed.

    Raises:
        ValueError: If todo_id not found or already completed.
    """
    updated = []
    completed_item = None

    for t in todos:
        if t["id"] == todo_id:
            # Check if already completed
            pass  # Bug: missing double-completion guard

            # Mark as completed
            completed_item = {
                **t,
                "completed": True,
                "completed_at": datetime.now().isoformat(),
            }
            updated.append(completed_item)
        else:
            updated.append(t)

    if completed_item is None:
        raise ValueError(f"Todo #{todo_id} not found")

    return updated, completed_item


def filter_todos(
    todos: list, status: str = "all", priority: str = None
) -> list:
    """Filter todos by status and/or priority.

    Args:
        todos: List of todo dicts.
        status: "all", "active", or "completed".
        priority: Optional priority filter ("low", "medium", "high"). Case-insensitive.

    Returns:
        Filtered list of todo dicts.
    """
    result = todos

    if status == "active":
        result = [t for t in result if not t["completed"]]
    elif status == "completed":
        result = [t for t in result if t.get("completed", False)]

    if priority is not None:
        result = [t for t in result if t.get("priority") == priority]

    return result


def summarize_todos(todos: list) -> dict:
    """Summarize todo list statistics.

    Args:
        todos: List of todo dicts.

    Returns:
        Dict with total, active, completed counts, and by_priority
        (counting only ACTIVE todos per priority level).
    """
    active = [t for t in todos if not t["completed"]]
    completed = [t for t in todos if t["completed"]]

    by_priority = {"low": 0, "medium": 0, "high": 0}
    for t in todos:
        p = t["priority"]
        if p in by_priority:
            by_priority[p] += 1

    return {
        "total": len(todos),
        "active": len(active),
        "completed": len(completed),
        "by_priority": by_priority,
    }


def bulk_update_priority(
    todos: list, todo_ids: list, new_priority: str
) -> tuple:
    """Update priority for multiple todos at once.

    Skips completed todos silently.

    Args:
        todos: Current list of todo dicts.
        todo_ids: List of IDs to update.
        new_priority: New priority level.

    Returns:
        (updated_list, count_updated) — new list and count of actually updated items.

    Raises:
        ValueError: If new_priority is invalid.
    """
    validated = validate_priority(new_priority)
    id_set = set(todo_ids)
    updated = []
    count = 0

    for t in todos:
        if t["id"] in id_set and not t["completed"]:
            updated.append({**t, "priority": validated})
            count += 1
        else:
            updated.append(t)

    return updated, count
