from collections import OrderedDict

class LRUCache:
    def __init__(self, capacity: int) -> None:
        if capacity < 0:
            raise ValueError("capacity must be non-negative")
        self.capacity = capacity
        self.cache = OrderedDict()

    def get(self, key) -> object | None:
        if key not in self.cache:
            return None
        value = self.cache[key]
        self.cache.move_to_end(key)
        return value

    def put(self, key, value) -> None:
        if self.capacity == 0:
            return
        if key in self.cache:
            self.cache[key] = value
            self.cache.move_to_end(key)
        else:
            if len(self.cache) >= self.capacity:
                self.cache.popitem(last=False)
            self.cache[key] = value