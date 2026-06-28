"""Pydantic request/response models."""
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, EmailStr, Field


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    username: str
    public_key: str
    encrypted_private_key: str
    pk_salt: str
    language: Optional[str] = "en"
    captcha_token: Optional[str] = None


class LoginIn(BaseModel):
    email: str = Field(min_length=1, max_length=128)  # email or username
    password: str
    totp_code: Optional[str] = None
    captcha_token: Optional[str] = None


class UsernameCheckIn(BaseModel):
    username: str


class GoogleSessionIn(BaseModel):
    id_token: Optional[str] = None
    session_id: Optional[str] = None  # legacy — unused


class GoogleOAuthExchangeIn(BaseModel):
    code: str = Field(min_length=16, max_length=256)


class FinishGoogleSetupIn(BaseModel):
    username: str
    public_key: str
    encrypted_private_key: str
    pk_salt: str
    language: Optional[str] = "en"


class PrivacySettingsIn(BaseModel):
    read_receipts: Optional[bool] = None
    typing_indicators: Optional[bool] = None
    last_seen: Optional[Literal["hidden", "online_only", "contacts"]] = None
    profile_photo: Optional[Literal["hidden", "contacts"]] = None


class UpdateProfileIn(BaseModel):
    username: Optional[str] = None
    language: Optional[str] = None
    retention_hours: Optional[int] = None
    privacy: Optional[PrivacySettingsIn] = None


class CreateConversationIn(BaseModel):
    peer_username: Optional[str] = None
    peer_usernames: Optional[List[str]] = None
    name: Optional[str] = None
    is_group: Optional[bool] = False


class SendMessageIn(BaseModel):
    conversation_id: str
    ciphertext: str
    protocol: str = "legacy_rsa"
    iv: Optional[str] = None
    encrypted_keys: Optional[Dict[str, str]] = None
    signal_message_type: Optional[int] = None
    distribution_id: Optional[str] = None
    message_type: str = "text"
    attachment_id: Optional[str] = None
    attachment_iv: Optional[str] = None
    attachment_encrypted_keys: Optional[Dict[str, str]] = None
    attachment_content_type: Optional[str] = None
    reply_to_message_id: Optional[str] = None


class UnsendMessageIn(BaseModel):
    conversation_id: str
    message_id: str


class EditMessageIn(BaseModel):
    conversation_id: str
    message_id: str
    protocol: str
    ciphertext: str
    iv: Optional[str] = None
    encrypted_keys: Optional[Dict[str, str]] = None
    signal_message_type: Optional[int] = None
    distribution_id: Optional[str] = None


class TwoFASetupVerifyIn(BaseModel):
    code: str


class TwoFADisableIn(BaseModel):
    password: Optional[str] = None
    code: str


class ChangePasswordIn(BaseModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)
    encrypted_private_key: str = Field(min_length=16, max_length=20000)
    pk_salt: str = Field(min_length=8, max_length=256)


class DeleteAccountIn(BaseModel):
    username_confirmation: str = Field(min_length=1, max_length=32)
    password: Optional[str] = Field(default=None, max_length=128)
    totp_code: Optional[str] = None


class AddGroupMembersIn(BaseModel):
    peer_usernames: List[str] = Field(min_length=1, max_length=20)


class PushSubscribeIn(BaseModel):
    endpoint: str
    keys: Dict[str, str]


class NativePushSubscribeIn(BaseModel):
    token: str = Field(min_length=10, max_length=4096)
    platform: Literal["android", "ios"]


class MarkReadIn(BaseModel):
    conversation_id: str
    up_to_message_id: Optional[str] = None


class TranslateIn(BaseModel):
    text: str
    target_language: str
    source_language: Optional[str] = None


class SendFriendRequestIn(BaseModel):
    username: str


class FriendRequestActionIn(BaseModel):
    request_id: str


class CreateStatusIn(BaseModel):
    protocol: str = "legacy_rsa"
    ciphertext: str
    iv: Optional[str] = None
    encrypted_keys: Optional[Dict[str, str]] = None
    signal_message_type: Optional[int] = None
    distribution_id: Optional[str] = None
    status_type: str = "text"
    attachment_id: Optional[str] = None
    background: Optional[str] = "#1E2A38"


class MarkStatusViewedIn(BaseModel):
    status_id: str


class OneTimePreKeyIn(BaseModel):
    prekey_id: int = Field(ge=0, le=16777215)
    public: str = Field(min_length=16, max_length=512)


class PrekeyBundleIn(BaseModel):
    registration_id: int = Field(ge=1, le=16380)
    device_id: int = Field(default=1, ge=1, le=1)
    identity_key_public: str = Field(min_length=16, max_length=512)
    signed_prekey_id: int = Field(ge=0, le=16777215)
    signed_prekey_public: str = Field(min_length=16, max_length=512)
    signed_prekey_signature: str = Field(min_length=64, max_length=128)
    kyber_prekey_id: int = Field(ge=0, le=16777215)
    kyber_prekey_public: str = Field(min_length=16, max_length=4096)
    kyber_prekey_signature: str = Field(min_length=64, max_length=128)
    one_time_prekeys: List[OneTimePreKeyIn] = Field(min_length=1, max_length=100)
    libsignal_version: Optional[str] = Field(default=None, max_length=32)