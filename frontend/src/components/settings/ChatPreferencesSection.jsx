import {
  getAutoTranslateEnabled,
  getLinkPreviewsEnabled,
  getSealedSenderEnabled,
  setAutoTranslateEnabled,
  setLinkPreviewsEnabled,
  setSealedSenderEnabled,
} from '../../lib/chatPrefs';
import styles from './ChatPreferencesSection.module.css';

function ToggleRow({ id, checked, onChange, label, hint, disabled }) {
  return (
    <div className={styles.toggleBlock}>
      <label className={styles.row} htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
        />
        <span>{label}</span>
      </label>
      {hint ? <p className={styles.rowHint}>{hint}</p> : null}
    </div>
  );
}

export default function ChatPreferencesSection({
  sealedSender,
  linkPreviews,
  autoTranslate,
  pushRichLabels,
  onSealedSenderChange,
  onLinkPreviewsChange,
  onAutoTranslateChange,
  onPushRichLabelsChange,
  saving = false,
}) {
  return (
    <section className={styles.section}>
      <h2>Chat &amp; notifications</h2>
      <p className={styles.intro}>
        Privacy-first defaults. Message content is never sent to SSC servers for these features.
      </p>

      <ToggleRow
        id="ssc-sealed-sender"
        checked={sealedSender}
        disabled={saving}
        onChange={(e) => {
          const enabled = e.target.checked;
          setSealedSenderEnabled(enabled);
          onSealedSenderChange?.(enabled);
        }}
        label="Sealed sender"
        hint="Hide your identity from the server when sending messages (recommended)."
      />

      <ToggleRow
        id="ssc-link-previews"
        checked={linkPreviews}
        disabled={saving}
        onChange={(e) => {
          const enabled = e.target.checked;
          setLinkPreviewsEnabled(enabled);
          onLinkPreviewsChange?.(enabled);
        }}
        label="Link previews"
        hint="Fetch link previews on your device only. Off by default."
      />

      <ToggleRow
        id="ssc-auto-translate"
        checked={autoTranslate}
        disabled={saving}
        onChange={(e) => {
          const enabled = e.target.checked;
          setAutoTranslateEnabled(enabled);
          onAutoTranslateChange?.(enabled);
        }}
        label="Auto-translate incoming messages"
        hint="Translate after decrypt on this device. Configure API keys in Translation below."
      />

      <ToggleRow
        id="ssc-push-rich-labels"
        checked={pushRichLabels}
        disabled={saving}
        onChange={(e) => onPushRichLabelsChange?.(e.target.checked)}
        label="Push notification labels"
        hint="Show contact or group name on push alerts. Never includes message text. Off by default."
      />
    </section>
  );
}

export function loadChatPreferenceDefaults() {
  return {
    sealedSender: getSealedSenderEnabled(),
    linkPreviews: getLinkPreviewsEnabled(),
    autoTranslate: getAutoTranslateEnabled(),
  };
}