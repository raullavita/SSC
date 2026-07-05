import { effectivePrivacy, privacyInherits } from '../../lib/conversationPrivacy';
import styles from './ChatPrivacyPanel.module.css';

const DISAPPEAR_OPTIONS = [
  { label: 'Inherit (off)', value: 'inherit' },
  { label: 'Off', value: 0 },
  { label: '1m', value: 60 },
  { label: '1h', value: 3600 },
  { label: '24h', value: 86400 },
];

function TriToggle({ label, inherit, value, onChange, hint }) {
  return (
    <label className={styles.row}>
      <span className={styles.rowLabel}>
        {label}
        {inherit && <span className={styles.inheritTag}>global</span>}
      </span>
      <select
        className={styles.select}
        value={inherit ? 'inherit' : value ? 'on' : 'off'}
        onChange={(e) => {
          const next = e.target.value;
          if (next === 'inherit') onChange(null);
          else onChange(next === 'on');
        }}
      >
        <option value="inherit">Use global</option>
        <option value="on">On</option>
        <option value="off">Off</option>
      </select>
      {hint && <span className={styles.hint}>{hint}</span>}
    </label>
  );
}

export default function ChatPrivacyPanel({
  open,
  onClose,
  overrides = {},
  globalSettings = {},
  onPatch,
}) {
  if (!open) return null;

  const effective = effectivePrivacy(overrides, globalSettings);

  return (
    <div className={styles.panel} role="region" aria-label="Chat privacy">
      <header className={styles.header}>
        <h3>Chat privacy</h3>
        <button type="button" className={styles.close} onClick={onClose}>
          ✕
        </button>
      </header>
      <p className={styles.intro}>
        Overrides apply only to this chat. Choose &quot;Use global&quot; to inherit account settings.
      </p>

      <TriToggle
        label="Read receipts"
        inherit={privacyInherits(overrides, 'read_receipts')}
        value={effective.read_receipts}
        onChange={(v) => onPatch({ read_receipts: v })}
      />
      <TriToggle
        label="Typing indicator"
        inherit={privacyInherits(overrides, 'typing_visible')}
        value={effective.typing_visible}
        onChange={(v) => onPatch({ typing_visible: v })}
      />
      <TriToggle
        label="Last seen"
        inherit={privacyInherits(overrides, 'last_seen_visible')}
        value={effective.last_seen_visible}
        onChange={(v) => onPatch({ last_seen_visible: v })}
        hint="Controls whether this contact sees your activity in this chat."
      />

      <label className={styles.row}>
        <span className={styles.rowLabel}>
          Disappearing default
          {privacyInherits(overrides, 'disappearing_seconds_default') && (
            <span className={styles.inheritTag}>off</span>
          )}
        </span>
        <select
          className={styles.select}
          value={
            privacyInherits(overrides, 'disappearing_seconds_default')
              ? 'inherit'
              : String(effective.disappearing_seconds_default || 0)
          }
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === 'inherit') onPatch({ disappearing_seconds_default: null });
            else onPatch({ disappearing_seconds_default: Number(raw) });
          }}
        >
          {DISAPPEAR_OPTIONS.map((opt) => (
            <option
              key={`disappear-${opt.label}`}
              value={opt.value === 'inherit' ? 'inherit' : String(opt.value)}
            >
              {opt.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}