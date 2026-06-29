"""Q.51 — linked devices policy and API."""
import pytest
from unittest.mock import AsyncMock, patch

from core.device_policy import (
    MAX_LINKED_DEVICES,
    assign_next_device_id,
    create_link_token,
    consume_link_token,
    unlink_device,
)


@pytest.mark.asyncio
async def test_assign_next_device_id_skips_used():
    with patch("core.device_policy.list_user_devices", new_callable=AsyncMock) as mock_list:
        mock_list.return_value = [{"device_id": 1}, {"device_id": 3}]
        assert await assign_next_device_id("user-1") == 2


@pytest.mark.asyncio
async def test_create_and_consume_link_token():
    inserted = {}

    async def fake_insert(doc):
        inserted.update(doc)

    async def fake_find_one(query):
        if query.get("token") == inserted.get("token"):
            return {**inserted, "consumed_at": None}
        return None

    async def fake_update_one(query, patch):
        inserted["consumed_at"] = patch["$set"]["consumed_at"]
        inserted["linked_device_id"] = patch["$set"].get("linked_device_id")

    class FakeTokens:
        insert_one = AsyncMock(side_effect=fake_insert)
        update_one = AsyncMock(side_effect=fake_update_one)
        find_one = AsyncMock(side_effect=fake_find_one)

    class FakeDevices:
        insert_one = AsyncMock()
        find_one = AsyncMock(return_value=None)
        update_one = AsyncMock()

    with patch("core.device_policy.db") as mock_db:
        mock_db.__getitem__ = lambda _self, key: {
            "device_link_tokens": FakeTokens(),
            "signal_devices": FakeDevices(),
        }[key]

        with patch("core.device_policy.list_user_devices", new_callable=AsyncMock) as mock_list:
            mock_list.return_value = [{"device_id": 1}]
            created = await create_link_token("user-1")
            assert created["token"]
            result = await consume_link_token(
                "user-1",
                created["token"],
                platform="desktop",
                device_name="Win laptop",
            )
            assert result["device_id"] == 2


@pytest.mark.asyncio
async def test_unlink_rejects_last_device():
    with patch("core.device_policy.list_user_devices", new_callable=AsyncMock) as mock_list:
        mock_list.return_value = [{"device_id": 1}]
        with pytest.raises(ValueError, match="cannot_unlink_last_device"):
            await unlink_device("user-1", 1)


def test_max_devices_constant():
    assert MAX_LINKED_DEVICES == 5