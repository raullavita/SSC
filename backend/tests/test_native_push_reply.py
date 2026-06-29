"""Q.43 — Android data-only FCM for reply-capable message notifications."""
from native_push import should_send_data_only_android
from core.push_payload import ACTIVITY_MESSAGE, ACTIVITY_CALL


def test_android_message_uses_data_only():
    payload = {"type": ACTIVITY_MESSAGE, "conversation_id": "c1"}
    assert should_send_data_only_android(payload, "android", silent=False) is True


def test_android_call_keeps_notification_payload():
    payload = {"type": ACTIVITY_CALL}
    assert should_send_data_only_android(payload, "android", silent=False) is False


def test_ios_message_keeps_notification_payload():
    payload = {"type": ACTIVITY_MESSAGE}
    assert should_send_data_only_android(payload, "ios", silent=False) is False


def test_silent_skips_data_only_path():
    payload = {"type": ACTIVITY_MESSAGE}
    assert should_send_data_only_android(payload, "android", silent=True) is False