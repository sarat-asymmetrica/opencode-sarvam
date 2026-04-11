import unittest
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lru_cache import LRUCache

class TestLRUCache(unittest.TestCase):
    def test_basic_put_get(self):
        c = LRUCache(2)
        c.put("a", 1)
        self.assertEqual(c.get("a"), 1)

    def test_missing_key_returns_none(self):
        c = LRUCache(2)
        self.assertIsNone(c.get("missing"))

    def test_capacity_eviction(self):
        c = LRUCache(2)
        c.put("a", 1)
        c.put("b", 2)
        c.put("c", 3)
        self.assertIsNone(c.get("a"))
        self.assertEqual(c.get("c"), 3)

    def test_get_moves_to_mru(self):
        c = LRUCache(2)
        c.put("a", 1)
        c.put("b", 2)
        c.get("a")
        c.put("c", 3)
        self.assertEqual(c.get("a"), 1)
        self.assertIsNone(c.get("b"))

    def test_put_update_moves_to_mru(self):
        c = LRUCache(2)
        c.put("a", 1)
        c.put("b", 2)
        c.put("a", 5)
        c.put("c", 3)
        self.assertEqual(c.get("a"), 5)
        self.assertIsNone(c.get("b"))

    def test_capacity_zero_is_noop(self):
        c = LRUCache(0)
        c.put("a", 1)
        self.assertIsNone(c.get("a"))
        c.put("b", 2)
        self.assertIsNone(c.get("b"))

    def test_negative_capacity_raises(self):
        with self.assertRaises(ValueError):
            LRUCache(-1)

if __name__ == "__main__":
    unittest.main()