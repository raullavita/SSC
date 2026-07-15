/**
 * Map API / crypto errors to user-visible chat messages.
 */

export function formatApiError(err, fallback = 'Something went wrong') {
  if (!err) return fallback;

  const detail = err?.body?.detail;
  if (detail) {
    if (typeof detail === 'string') {
      return formatDetailString(detail);
    }
    if (Array.isArray(detail)) {
      const parts = detail
        .map((item) => item?.msg || item?.message || String(item))
        .filter(Boolean);
      if (parts.length) return parts.join('; ');
    }
  }

  const msg = String(err?.message || '').trim();
  if (msg) {
    if (msg.startsWith('contact_prekeys_missing')) {
      return 'This contact has not registered encryption keys yet. Ask them to open SSC once, then try again.';
    }
    if (msg.startsWith('libsignal_session_setup_failed:')) {
      const code = msg.split(':').slice(1).join(':') || 'unknown';
      if (code === 'prekey_bundle_not_found') {
        return 'This contact has not registered encryption keys yet. Ask them to open SSC once, then try again.';
      }
      return `Could not set up encrypted session (${code}).`;
    }
    if (msg === 'group_id_and_user_required') {
      return 'Group encryption is not ready for this chat. Try reopening the group or creating it again.';
    }
    if (/^HTTP \d+/.test(msg)) {
      return fallback;
    }
    if (/failed to fetch|fetch failed|ERR_|network|api_url_not_configured/i.test(msg)) {
      return 'Cannot reach the server. Check your internet connection or firewall, then try again.';
    }
    return msg;
  }

  return fallback;
}

function formatDetailString(detail) {
  if (detail === 'contact_prekeys_missing' || detail === 'prekey_bundle_not_found') {
    return 'This contact has not registered encryption keys yet. Ask them to open SSC once, then try again.';
  }
  if (detail === 'message_rate_limited') {
    return 'You are sending messages too quickly. Wait a moment and try again.';
  }
  if (detail === 'conversation_blocked') {
    return 'You cannot message this contact (blocked).';
  }
  if (detail === 'installed_client_outdated') {
    return 'This app build is outdated. Download the latest SSC installer from supersecurechat.com.';
  }
  return detail;
}