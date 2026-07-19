import { useState } from 'react';
import styles from '../../pages/Settings.module.css';

/**
 * P4: Collapsible settings group (WhatsApp-style sections).
 */
export default function SettingsSection({
  title,
  defaultOpen = true,
  children,
  danger = false,
  id,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = id ? `settings-panel-${id}` : undefined;

  return (
    <section
      className={`${styles.section} ${danger ? styles.danger : ''}`}
      data-settings-section={id || title}
    >
      <button
        type="button"
        className={styles.sectionHeader}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <h2 className={styles.sectionTitle}>{title}</h2>
        <span className={styles.sectionChevron} aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && (
        <div className={styles.sectionBody} id={panelId}>
          {children}
        </div>
      )}
    </section>
  );
}
