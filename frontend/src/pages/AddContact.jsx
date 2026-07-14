import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { checkBlockedBy } from '../lib/abuseReport';
import { lookupPathForQuery, normalizeUsername } from '../lib/inviteLink';
import styles from './AddContact.module.css';

export default function AddContact() {
  const { username } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('Looking up contact…');

  useEffect(() => {
    if (loading) return undefined;
    if (!user) return undefined;

    const name = normalizeUsername(username);
    if (!name) {
      setError('Invalid username');
      return undefined;
    }

    let cancelled = false;

    async function run() {
      try {
        const lookup = await api.get(lookupPathForQuery(name));
        if (cancelled) return;
        const peer = lookup.user;
        if (await checkBlockedBy(peer.id)) {
          setError('You are blocked by this user');
          return;
        }
        setStatus(`Sending friend request to ${peer.display_name || peer.username || peer.id}…`);
        const result = await api.post('/api/friend_requests', { to_user_id: peer.id });
        if (cancelled) return;
        if (result.existing) {
          setStatus('Friend request already pending — check incoming requests in chat.');
        } else {
          setStatus('Friend request sent. They can accept from their SSC app.');
        }
      } catch (err) {
        if (!cancelled) {
          const detail = err.body?.detail || err.message || 'Could not send request';
          if (detail === 'already_contacts') {
            const lookup = await api.get(lookupPathForQuery(name));
            const conv = await api.post('/api/conversations', {
              participant_id: lookup.user.id,
            });
            navigate('/chat', {
              replace: true,
              state: { openConversationId: conv.conversation.id },
            });
            return;
          }
          setError(detail);
          setStatus(null);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [user, loading, username, navigate]);

  if (!loading && !user) {
    return <Navigate to={`/login?next=/add/${encodeURIComponent(username || '')}`} replace />;
  }

  return (
    <div className={styles.page}>
      <h1>Add contact</h1>
      {username && <p className={styles.username}>@{normalizeUsername(username)}</p>}
      {status && <p className={styles.status}>{status}</p>}
      {error && (
        <>
          <p className={styles.error}>{error}</p>
          <Link to="/chat" className={styles.link}>
            Back to chat
          </Link>
        </>
      )}
      {!error && status && !status.includes('Sending') && (
        <Link to="/chat" className={styles.link}>
          Back to chat
        </Link>
      )}
    </div>
  );
}