import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import styles from './SiteFeedbackPanel.module.css';

const GITHUB_ISSUES = 'https://github.com/raullavita/SSC/issues/new/choose';

const CATEGORY_OPTIONS = [
  { value: 'review', label: 'Review — tell others what you think' },
  { value: 'problem', label: 'Problem — something not working' },
  { value: 'bug', label: 'Bug report (short summary)' },
  { value: 'idea', label: 'Feature idea' },
];

function formatDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

function Stars({ rating }) {
  if (!rating) return null;
  return (
    <span className={styles.stars} aria-label={`${rating} out of 5 stars`}>
      {'★'.repeat(rating)}
      {'☆'.repeat(5 - rating)}
    </span>
  );
}

export default function SiteFeedbackPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [form, setForm] = useState({
    display_name: '',
    rating: '5',
    category: 'review',
    platform: 'windows',
    message: '',
  });

  const loadFeedback = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/api/public/feedback');
      setItems(data.feedback || []);
    } catch (err) {
      setError(err.message || 'Could not load feedback');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        display_name: form.display_name.trim() || undefined,
        category: form.category,
        platform: form.platform,
        message: form.message.trim(),
      };
      if (form.category === 'review') {
        payload.rating = Number(form.rating);
      }
      const data = await api.post('/api/public/feedback', payload);
      if (data.published) {
        setSuccess('Thanks — your feedback is live on this page.');
        setForm((f) => ({ ...f, message: '' }));
        await loadFeedback();
      } else {
        setSuccess('Thanks — we received your note and will review it before publishing.');
        setForm((f) => ({ ...f, message: '' }));
      }
    } catch (err) {
      setError(err.body?.detail || err.message || 'Could not send feedback');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.intro}>
        <p className={styles.lead}>
          Downloaded SSC? Leave a review here or open a detailed bug on{' '}
          <a href={GITHUB_ISSUES} target="_blank" rel="noopener noreferrer">
            GitHub Issues
          </a>
          . No account needed for short reviews on this page.
        </p>
      </div>

      <div className={styles.grid}>
        <form className={styles.form} onSubmit={onSubmit}>
          <h3 className={styles.formTitle}>Share your experience</h3>

          <label className={styles.field}>
            <span>Display name (optional)</span>
            <input
              value={form.display_name}
              onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
              placeholder="Alex"
              maxLength={40}
            />
          </label>

          <label className={styles.field}>
            <span>Type</span>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Platform</span>
            <select
              value={form.platform}
              onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
            >
              <option value="windows">Windows desktop</option>
              <option value="android">Android</option>
              <option value="website">Website</option>
              <option value="other">Other</option>
            </select>
          </label>

          {form.category === 'review' && (
            <label className={styles.field}>
              <span>Rating</span>
              <select
                value={form.rating}
                onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))}
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={String(n)}>
                    {n} — {n === 5 ? 'Excellent' : n === 1 ? 'Poor' : `${n} stars`}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className={styles.field}>
            <span>Message</span>
            <textarea
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              placeholder="What worked? What should we fix? (min 10 characters)"
              rows={5}
              required
              minLength={10}
              maxLength={2000}
            />
          </label>

          {error && (
            <p className={styles.error} role="alert">
              {String(error)}
            </p>
          )}
          {success && <p className={styles.success}>{success}</p>}

          <button type="submit" className={styles.submit} disabled={submitting}>
            {submitting ? 'Sending…' : 'Post feedback'}
          </button>

          <p className={styles.hint}>
            For security issues use{' '}
            <a href="https://github.com/raullavita/SSC/blob/main/SECURITY.md">SECURITY.md</a> — not
            public comments.
          </p>
        </form>

        <div className={styles.listPane}>
          <h3 className={styles.formTitle}>Community feedback</h3>
          {loading && <p className={styles.muted}>Loading…</p>}
          {!loading && items.length === 0 && (
            <p className={styles.muted}>No public reviews yet — be the first after you try SSC.</p>
          )}
          <ul className={styles.list}>
            {items.map((row) => (
              <li key={row.id} className={styles.item}>
                <div className={styles.itemHead}>
                  <strong>{row.display_name}</strong>
                  <Stars rating={row.rating} />
                </div>
                <p className={styles.itemMeta}>
                  {row.category}
                  {row.platform ? ` · ${row.platform}` : ''}
                  {row.created_at ? ` · ${formatDate(row.created_at)}` : ''}
                </p>
                <p className={styles.itemBody}>{row.message}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}