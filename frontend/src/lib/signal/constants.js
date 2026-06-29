/** Pinned official libsignal — must match backend/core/signal_policy.py */
export const LIBSIGNAL_PINNED_VERSION = '0.96.4';
export const LIBSIGNAL_NPM_PACKAGE = '@signalapp/libsignal-client';
export const LIBSIGNAL_ANDROID_ARTIFACT = 'org.signal:libsignal-android';

export const ProtocolVersion = {
  LEGACY_RSA: 'legacy_rsa',
  SIGNAL_V1: 'signal_v1',
  SIGNAL_GROUP_V1: 'signal_group_v1',
  SIGNAL_STATUS_V1: 'signal_status_v1',
};

/** libsignal CiphertextMessage types */
export const SignalMessageType = {
  WHISPER: 2,
  PREKEY: 3,
  SENDERKEY: 7,
};

export const SKDM_MESSAGE_TYPE = 'sender_key_distribution';