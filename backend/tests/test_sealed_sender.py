"""Q.52 — sealed sender delivery tokens and message storage."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from core.sealed_sender_tokens import consume_delivery_token, mint_delivery_token


@pytest.mark.asyncio
async def test_mint_and_consume_delivery_token():
    stored = {}

    async def fake_insert(doc):
        stored.update(doc)

    async def fake_find_one(query):
        if query.get("token_hash") == stored.get("token_hash"):
            return {**stored, "consumed_at": stored.get("consumed_at")}
        return None

    async def fake_update_one(query, patch):
        stored["consumed_at"] = patch["$set"]["consumed_at"]

    class FakeTokens:
        insert_one = AsyncMock(side_effect=fake_insert)
        find_one = AsyncMock(side_effect=fake_find_one)
        update_one = AsyncMock(side_effect=fake_update_one)

    with patch("core.sealed_sender_tokens.db") as mock_db:
        mock_db.__getitem__ = lambda _self, key: FakeTokens() if key == "sealed_delivery_tokens" else MagicMock()
        created = await mint_delivery_token("user-a", "conv-1")
        assert created["token"]
        issuer = await consume_delivery_token(created["token"], "conv-1")
        assert issuer == "user-a"
        assert await consume_delivery_token(created["token"], "conv-1") is None


@pytest.mark.asyncio
async def test_send_sealed_message_stores_no_sender_id():
    from routers.messages import send_sealed_message
    from core.models import SendSealedMessageIn

    body = SendSealedMessageIn(
        delivery_token="tok-test-1234567890",
        conversation_id="conv-1",
        protocol="signal_v1",
        ciphertext="QUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQQ==",
        signal_message_type=2,
        message_type="text",
    )

    mock_coll = MagicMock()
    mock_coll.insert_one = AsyncMock()

    conv = {"conversation_id": "conv-1", "participants": ["user-a", "user-b"], "is_group": False}

    with patch("routers.messages.consume_delivery_token", new_callable=AsyncMock) as mock_consume, patch(
        "routers.messages.db"
    ) as mock_db, patch("routers.messages.rate_limit_check", return_value=True), patch(
        "routers.messages.are_contacts", new_callable=AsyncMock, return_value=True
    ), patch(
        "routers.messages.is_blocked_pair", new_callable=AsyncMock, return_value=False
    ), patch(
        "routers.messages.validate_reply_target", new_callable=AsyncMock, return_value=None
    ), patch(
        "routers.messages.get_effective_retention_for_conversation", new_callable=AsyncMock, return_value=24
    ), patch(
        "routers.messages.bump_conversation_activity", new_callable=AsyncMock
    ), patch(
        "routers.messages.broadcast_message_to_conversation", new_callable=AsyncMock
    ), patch(
        "routers.messages.send_push_for_sealed_message", new_callable=AsyncMock
    ), patch("core.last_seen.touch_last_seen", new_callable=AsyncMock), patch(
        "routers.messages.asyncio.create_task"
    ):
        mock_consume.return_value = "user-a"
        mock_db.conversations.find_one = AsyncMock(return_value=conv)
        mock_db.messages = mock_coll

        result = await send_sealed_message(body)

    assert result["sealed_sender"] is True
    assert result.get("sender_id") is None
    inserted = mock_coll.insert_one.call_args[0][0]
    assert inserted["sealed_sender"] is True
    assert inserted.get("sender_id") is None