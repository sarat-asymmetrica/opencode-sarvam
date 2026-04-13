"""Unit tests for the todo API pure core."""

import unittest
from datetime import datetime
from todo_core import (
    create_todo,
    complete_todo,
    filter_todos,
    summarize_todos,
    bulk_update_priority,
)
from todo_helpers import validate_priority, generate_id, format_todo_line, format_todo_list


class TestCreateTodo(unittest.TestCase):
    def test_create_first_todo(self):
        """First todo gets id=1."""
        todos, item = create_todo([], "Buy milk")
        self.assertEqual(item["id"], 1)
        self.assertEqual(item["title"], "Buy milk")
        self.assertEqual(item["priority"], "medium")
        self.assertFalse(item["completed"])
        self.assertEqual(len(todos), 1)

    def test_create_second_todo_gets_id_2(self):
        """Second todo gets id=2, not id=1."""
        todos, _ = create_todo([], "First task")
        todos, item = create_todo(todos, "Second task")
        self.assertEqual(item["id"], 2)
        self.assertEqual(len(todos), 2)

    def test_create_with_priority(self):
        """Custom priority is validated and normalized."""
        todos, item = create_todo([], "Urgent task", "HIGH")
        self.assertEqual(item["priority"], "high")

    def test_create_with_invalid_priority_raises(self):
        """Invalid priority raises ValueError."""
        with self.assertRaises(ValueError):
            create_todo([], "Bad task", "critical")

    def test_create_does_not_mutate_original(self):
        """create_todo returns a NEW list, does not mutate the input."""
        original = []
        new_todos, _ = create_todo(original, "Task")
        self.assertEqual(len(original), 0)
        self.assertEqual(len(new_todos), 1)


class TestCompleteTodo(unittest.TestCase):
    def test_complete_existing_todo(self):
        """Completing a todo sets completed=True and completed_at."""
        todos, _ = create_todo([], "Task 1")
        todos, completed = complete_todo(todos, 1)
        self.assertTrue(completed["completed"])
        self.assertIsNotNone(completed["completed_at"])

    def test_complete_nonexistent_raises(self):
        """Completing a non-existent todo raises ValueError."""
        todos, _ = create_todo([], "Task 1")
        with self.assertRaises(ValueError) as cm:
            complete_todo(todos, 999)
        self.assertIn("not found", str(cm.exception))

    def test_complete_already_completed_raises(self):
        """Double-completing raises ValueError."""
        todos, _ = create_todo([], "Task 1")
        todos, _ = complete_todo(todos, 1)
        with self.assertRaises(ValueError) as cm:
            complete_todo(todos, 1)
        self.assertIn("already completed", str(cm.exception))

    def test_complete_does_not_mutate_original(self):
        """complete_todo returns a NEW list."""
        todos, _ = create_todo([], "Task 1")
        original_len = len(todos)
        new_todos, _ = complete_todo(todos, 1)
        self.assertEqual(len(todos), original_len)
        self.assertFalse(todos[0]["completed"])


class TestFilterTodos(unittest.TestCase):
    def _make_mixed_todos(self):
        """Helper: create a mix of active and completed todos."""
        todos, _ = create_todo([], "Active high", "high")
        todos, _ = create_todo(todos, "Active low", "low")
        todos, _ = create_todo(todos, "Will complete", "medium")
        todos, _ = complete_todo(todos, 3)
        return todos

    def test_filter_all_returns_everything(self):
        """status='all' returns all todos."""
        todos = self._make_mixed_todos()
        self.assertEqual(len(filter_todos(todos, status="all")), 3)

    def test_filter_active(self):
        """status='active' returns only uncompleted."""
        todos = self._make_mixed_todos()
        active = filter_todos(todos, status="active")
        self.assertEqual(len(active), 2)
        for t in active:
            self.assertFalse(t["completed"])

    def test_filter_by_priority_case_insensitive(self):
        """Priority filter is case-insensitive."""
        todos = self._make_mixed_todos()
        result = filter_todos(todos, priority="HIGH")
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["title"], "Active high")

    def test_filter_combined_status_and_priority(self):
        """Both status and priority filters combine with AND."""
        todos = self._make_mixed_todos()
        result = filter_todos(todos, status="active", priority="low")
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["title"], "Active low")


class TestSummarizeTodos(unittest.TestCase):
    def test_summarize_mixed(self):
        """Summary counts are correct for mixed todo list."""
        todos, _ = create_todo([], "High task", "high")
        todos, _ = create_todo(todos, "Low task", "low")
        todos, _ = create_todo(todos, "Done task", "medium")
        todos, _ = complete_todo(todos, 3)

        summary = summarize_todos(todos)
        self.assertEqual(summary["total"], 3)
        self.assertEqual(summary["active"], 2)
        self.assertEqual(summary["completed"], 1)

    def test_by_priority_counts_only_active(self):
        """by_priority should count ONLY active todos, not completed ones."""
        todos, _ = create_todo([], "High task", "high")
        todos, _ = create_todo(todos, "Medium done", "medium")
        todos, _ = complete_todo(todos, 2)

        summary = summarize_todos(todos)
        self.assertEqual(summary["by_priority"]["high"], 1)
        self.assertEqual(summary["by_priority"]["medium"], 0)  # completed, not counted

    def test_summarize_empty(self):
        """Empty list gives zero counts."""
        summary = summarize_todos([])
        self.assertEqual(summary["total"], 0)
        self.assertEqual(summary["by_priority"], {"low": 0, "medium": 0, "high": 0})


class TestHelpers(unittest.TestCase):
    def test_validate_priority_normalizes_case(self):
        """validate_priority normalizes to lowercase."""
        self.assertEqual(validate_priority("HIGH"), "high")
        self.assertEqual(validate_priority("Medium"), "medium")

    def test_generate_id_increments(self):
        """generate_id returns max + 1."""
        todos = [{"id": 1}, {"id": 5}, {"id": 3}]
        self.assertEqual(generate_id(todos), 6)

    def test_format_todo_line_active(self):
        """Active todo shows [ ] checkbox."""
        todo = {"id": 3, "title": "Buy groceries", "priority": "high", "completed": False}
        self.assertEqual(format_todo_line(todo), "[ ] #3 (high) Buy groceries")

    def test_format_todo_line_completed(self):
        """Completed todo shows [X] checkbox."""
        todo = {"id": 3, "title": "Buy groceries", "priority": "high", "completed": True}
        self.assertEqual(format_todo_line(todo), "[X] #3 (high) Buy groceries")


if __name__ == "__main__":
    unittest.main()
