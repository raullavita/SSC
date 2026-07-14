"""In-memory async Mongo stand-in for unit tests."""

from __future__ import annotations

from copy import deepcopy
from typing import Any


class FakeCursor:
    def __init__(self, items: list[dict]) -> None:
        self._items = items
        self._sort_key: str | None = None
        self._sort_dir = 1
        self._limit: int | None = None

    def limit(self, n: int) -> FakeCursor:
        self._limit = n
        return self

    def sort(self, key: str, direction: int = 1) -> FakeCursor:
        self._sort_key = key
        self._sort_dir = direction
        return self

    def __aiter__(self):
        items = list(self._items)
        if self._sort_key:
            items.sort(key=lambda d: d.get(self._sort_key), reverse=self._sort_dir < 0)
        if self._limit is not None:
            items = items[: self._limit]
        self._iter = iter(items)
        return self

    async def __anext__(self):
        try:
            return next(self._iter)
        except StopIteration as exc:
            raise StopAsyncIteration from exc


class FakeCollection:
    def __init__(self) -> None:
        self.docs: list[dict] = []

    async def find_one(self, query: dict, projection: dict | None = None) -> dict | None:
        _ = projection
        for doc in self.docs:
            if _matches(doc, query):
                return deepcopy(doc)
        return None

    def find(self, query: dict, projection: dict | None = None) -> FakeCursor:
        _ = projection
        return FakeCursor([deepcopy(d) for d in self.docs if _matches(d, query)])

    async def insert_one(self, doc: dict) -> None:
        self.docs.append(deepcopy(doc))

    async def find_one_and_update(
        self,
        query: dict,
        update: dict,
        return_document: Any = None,
        projection: dict | None = None,
    ) -> dict | None:
        _ = return_document, projection
        for i, doc in enumerate(self.docs):
            if _matches(doc, query):
                before = deepcopy(doc)
                merged = deepcopy(doc)
                if "$pop" in update:
                    for key, index in update["$pop"].items():
                        current = list(merged.get(key) or [])
                        if not current:
                            return None
                        if index == -1:
                            current.pop(0)
                        elif index == 1:
                            current.pop()
                        merged[key] = current
                if "$set" in update:
                    merged.update(update["$set"])
                self.docs[i] = merged
                return before
        return None

    async def update_one(self, query: dict, update: dict, upsert: bool = False) -> None:
        for i, doc in enumerate(self.docs):
            if _matches(doc, query):
                merged = deepcopy(doc)
                if "$pop" in update:
                    for key, index in update["$pop"].items():
                        current = list(merged.get(key) or [])
                        if index == -1 and current:
                            current.pop(0)
                        elif index == 1 and current:
                            current.pop()
                        merged[key] = current
                if "$set" in update:
                    merged.update(update["$set"])
                if "$addToSet" in update:
                    for key, value in update["$addToSet"].items():
                        current = merged.get(key)
                        if current is None:
                            merged[key] = [value]
                        elif isinstance(current, list) and value not in current:
                            merged[key] = [*current, value]
                if "$unset" in update:
                    for key in update["$unset"]:
                        merged.pop(key, None)
                if "$inc" in update:
                    for key, value in update["$inc"].items():
                        merged[key] = int(merged.get(key, 0)) + int(value)
                self.docs[i] = merged
                return
        if upsert:
            new_doc = deepcopy(query)
            if "$setOnInsert" in update:
                new_doc.update(update["$setOnInsert"])
            if "$set" in update:
                new_doc.update(update["$set"])
            self.docs.append(new_doc)

    async def delete_one(self, query: dict) -> Any:
        before = len(self.docs)
        self.docs = [d for d in self.docs if not _matches(d, query)]
        deleted = before - len(self.docs)
        return type("R", (), {"deleted_count": deleted})()

    async def delete_many(self, query: dict) -> Any:
        return await self.delete_one(query)

    async def count_documents(self, query: dict) -> int:
        return len([d for d in self.docs if _matches(d, query)])

    async def replace_one(self, query: dict, doc: dict, upsert: bool = False) -> None:
        for i, existing in enumerate(self.docs):
            if _matches(existing, query):
                self.docs[i] = deepcopy(doc)
                return
        if upsert:
            self.docs.append(deepcopy(doc))


class FakeDatabase:
    def __init__(self) -> None:
        self._collections: dict[str, FakeCollection] = {}

    def __getitem__(self, name: str) -> FakeCollection:
        if name not in self._collections:
            self._collections[name] = FakeCollection()
        return self._collections[name]

    def __getattr__(self, name: str) -> FakeCollection:
        if name.startswith("_"):
            raise AttributeError(name)
        return self[name]


def _nested_value(doc: dict, path: str):
    cur: Any = doc
    for part in path.split("."):
        if isinstance(cur, list):
            if not part.isdigit():
                return None
            idx = int(part)
            cur = cur[idx] if 0 <= idx < len(cur) else None
        elif isinstance(cur, dict):
            cur = cur.get(part)
        else:
            return None
    return cur


def _matches(doc: dict, query: dict) -> bool:
    for key, expected in query.items():
        if key == "$or":
            if not any(_matches(doc, clause) for clause in expected):
                return False
            continue
        value = _nested_value(doc, key) if "." in key else doc.get(key)
        if isinstance(expected, dict):
            if "$all" in expected:
                items = value or []
                if not all(item in items for item in expected["$all"]):
                    return False
                continue
            if "$in" in expected:
                if value not in expected["$in"]:
                    return False
                continue
            if "$gte" in expected:
                if value is None or not (value >= expected["$gte"]):
                    return False
                continue
            if "$gt" in expected:
                if value is None or not (value > expected["$gt"]):
                    return False
                continue
            if "$exists" in expected:
                if "." in key:
                    exists = _nested_value(doc, key) is not None
                else:
                    exists = key in doc and doc.get(key) is not None
                if bool(expected["$exists"]) != exists:
                    return False
                continue
        if key in ("participants", "member_ids") and isinstance(expected, str):
            if expected not in (value or []):
                return False
            continue
        if value != expected:
            return False
    return True