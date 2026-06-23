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


class FinishGoogleSetupIn(BaseModel):
    username: str
    public_key: str
    encrypted_private_key: str
    pk_salt: str
    language: Optional[str] = "en"


class UpdateProfileIn(BaseModel):
    username: Optional[str] = None
    language: Optional[str] = None


class CreateConversationIn(BaseModel):
    peer_username: Optional[str] = None
    peer_usernames: Optional[List[str]] = None
    name: Optional[str] = None
    is_group: Optional[bool] = False


class SendMessageIn(BaseModel):
    conversation_id: str
    ciphertext: str
    iv: str
    encrypted_keys: Dict[str, str]
    message_type: str = "text"
    attachment_id: Optional[str] = None
    attachment_iv: Optional[str] = None
    attachment_encrypted_keys: Optional[Dict[str, str]] = None
    attachment_content_type: Optional[str] = None


class TwoFASetupVerifyIn(BaseModel):
    code: str


class TwoFADisableIn(BaseModel):
    password: Optional[str] = None
    code: str


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


class CreateInviteIn(BaseModel):
    expires_hours: Optional[int] = 24


class SendFriendRequestIn(BaseModel):
    username: str


class FriendRequestActionIn(BaseModel):
    request_id: str


class CreateStatusIn(BaseModel):
    ciphertext: str
    iv: str
    encrypted_keys: Dict[str, str]
    status_type: str = "text"
    attachment_id: Optional[str] = None
    background: Optional[str] = "#1E2A38"


class MarkStatusViewedIn(BaseModel):
    status_id: str