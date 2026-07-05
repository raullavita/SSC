import { useState } from 'react';
import { submitAbuseReport } from '../lib/abuseReport';
import styles from './AbuseReportPanel.module.css';

export default function AbuseReportPanel({ onMessage }) {
  const [targetUserId, setTargetUserId] = useState('');
  const [conversationId, setConversationId] = useState('');
  const [reason, setReason] = useState('');
  const [sampleText, setSampleText] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!targetUserId.trim() || !reason.trim()) {
      onMessage?.('Enter a user ID and reason.');
      return;
    }
    setBusy(true);
    try {
      const result = await submitAbuseReport({
        targetUserId: targetUserId.trim(),
        conversationId: conversationId.trim() || null,
        reason: reason.trim(),
        sampleText: sampleText.trim(),
      });
      onMessage?.(
        result?.ok
          ? 'Report submitted. SSC stores metadata only — no message content on the server.'
          : 'Report could not be submitted.'
      );
      setReason('');
      setSampleText('');
    } catch (err) {
      onMessage?.(err?.message || 'Report failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <p className={styles.hint}>
        Report spam or abuse. Only user IDs and your reason are stored — not E2E message content.
      </p>
      <label className={styles.rowStack}>
        <span>Target user ID</span>
        <input
          className={styles.input}
          value={targetUserId}
          onChange={(e) => setTargetUserId(e.target.value)}
          placeholder="User ID to report"
          required
        />
      </label>
      <label className={styles.rowStack}>
        <span>Conversation ID (optional)</span>
        <input
          className={styles.input}
          value={conversationId}
          onChange={(e) => setConversationId(e.target.value)}
          placeholder="Conversation context"
        />
      </label>
      <label className={styles.rowStack}>
        <span>Reason</span>
        <input
          className={styles.input}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Spam, harassment, etc."
          required
        />
      </label>
      <label className={styles.rowStack}>
        <span>Sample text for spam scoring (optional, local only)</span>
        <textarea
          className={styles.textarea}
          value={sampleText}
          onChange={(e) => setSampleText(e.target.value)}
          placeholder="Paste sample if reporting spam patterns"
          rows={3}
        />
      </label>
      <button type="submit" className={styles.button} disabled={busy}>
        {busy ? 'Submitting…' : 'Submit report'}
      </button>
    </form>
  );
}