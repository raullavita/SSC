"""In-memory async Mongo stand-in for unit tests."""

from __future__ import annotations

from copy import deepcopy
from typing import Any


class FakeCursor:
    def __init__(self, items: list[dict]) -> None:
        self._items = items
        self._sort_key: str | None = None
        self._sort_dir = 1

    def sort(self, key: str, direction: int = 1) -> FakeCursor:
        self._sort_key = key
        self._sort_dir = direction
        return self

    def __aiter__(self):
        items = list(self._items)
        if self._sort_key:
            items.sort(key=lambda d: d.get(self._sort_key), reverse=self._sort_dir < 0)
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

    async def update_one(self, query: dict, update: dict, upsert: bool = False) -> None:
        for i, doc in enumerate(self.docs):
            if _matches(doc, query):
                if "$set" in update:
                    self.docs[i] = {**doc, **update["$set"]}
                return
        if upsert and "$set" in update:
            new_doc = {**query, **update["$set"]}
            self.docs.append(new_doc)

    async def delete_many(self, query: dict) -> Any:
        before = len(self.docs)
        self.docs = [d for d in self.docs if not _matches(d, query)]
        deleted = before - len(self.docs)
        result = type("R", (), {"deleted_count": deleted})()
        return result

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


def _matches(doc: dict, query: dict) -> bool:
    for key, expected in query.items():
        if key == "$or":
            if not any(_matches(doc, clause) for clause in expected):
                return False
            continue
        value = doc.get(key)
        if isinstance(expected, dict):
            if "$in" in expected:
                if value not in expected["$in"]:
                    return False
                continue
            if "$gt" in expected:
                if value is None or not (value > expected["$gt"]):
                    return False
                continue
            if "$exists" in expected:
                exists = key in doc and doc.get(key) is not None
                if bool(expected["$exists"]) != exists:
                    return False
                continue
        if key == "participants" and isinstance(expected, str):
            if expected not in (value or []):
                return False
            continue
        if value != expected:
            return False
    return True