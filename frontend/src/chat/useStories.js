import { useCallback, useEffect, useState } from 'react';
import { decryptMessage } from '../signal/signalBridge';
import { createStory, deleteStory, fetchStoriesFeed } from './stories';

export function useStories(userId) {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchStoriesFeed();
      const hydrated = [];
      for (const story of rows) {
        let text = '[encrypted story]';
        try {
          if (story.user_id === userId) {
            text = await decryptMessage(story.ciphertext, { peerId: story.user_id });
          } else {
            text = await decryptMessage(story.ciphertext, { peerId: story.user_id });
          }
        } catch {
          text = '[story]';
        }
        hydrated.push({ ...story, text });
      }
      setStories(hydrated);
    } catch (e) {
      setError(e.message || 'Failed to load stories');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    reload();
    const timer = setInterval(reload, 60_000);
    return () => clearInterval(timer);
  }, [reload]);

  const postStory = useCallback(
    async (text, { peerId } = {}) => {
      await createStory(text, { peerId });
      await reload();
    },
    [reload]
  );

  const removeStory = useCallback(
    async (storyId) => {
      await deleteStory(storyId);
      setStories((prev) => prev.filter((s) => s.id !== storyId));
    },
    []
  );

  const byUser = stories.reduce((acc, story) => {
    if (!acc[story.user_id]) acc[story.user_id] = [];
    acc[story.user_id].push(story);
    return acc;
  }, {});

  return { stories, byUser, loading, error, reload, postStory, removeStory };
}