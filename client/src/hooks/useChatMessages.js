import { useState, useCallback, useRef } from 'react';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export const useChatMessages = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef(new Map());

  // Fetch direct messages with caching
  const fetchMessages = useCallback(
    async (receiverId, forceRefresh = false) => {
      if (!receiverId) return;

      // Check cache first (unless force refresh)
      const cacheKey = `direct_${receiverId}`;
      if (!forceRefresh && cacheRef.current.has(cacheKey)) {
        setMessages(cacheRef.current.get(cacheKey));
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/chat/${receiverId}`, {
          credentials: 'include',
        });
        const msgs = await res.json();
        setMessages(msgs);
        cacheRef.current.set(cacheKey, msgs);
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Fetch system messages
  const fetchSystemMessages = useCallback(async () => {
    const cacheKey = 'system';
    if (cacheRef.current.has(cacheKey)) {
      setMessages(cacheRef.current.get(cacheKey));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/chat/system`, {
        credentials: 'include',
      });
      const msgs = await res.json();
      setMessages(msgs);
      cacheRef.current.set(cacheKey, msgs);
    } catch (error) {
      console.error('Error fetching system messages:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch tryout messages
  const fetchTryoutMessages = useCallback(
    async (chatId) => {
      if (!chatId) return null;

      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/tryout-chats/${chatId}`, {
          credentials: 'include',
        });
        const data = await res.json();
        setMessages(data.chat?.messages || []);
        return data.chat;
      } catch (error) {
        console.error('Error fetching tryout messages:', error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Update cache when new message is added
  const addMessageToCache = useCallback(
    (chatId, message, chatType = 'direct') => {
      const cacheKey = chatType === 'direct' ? `direct_${chatId}` : `tryout_${chatId}`;
      if (cacheRef.current.has(cacheKey)) {
        const cached = cacheRef.current.get(cacheKey);
        cacheRef.current.set(cacheKey, [...cached, message]);
      }
    },
    []
  );

  // Clear specific cache entry
  const clearCache = useCallback(
    (chatId, chatType = 'direct') => {
      const cacheKey = chatType === 'direct' ? `direct_${chatId}` : `tryout_${chatId}`;
      cacheRef.current.delete(cacheKey);
    },
    []
  );

  // Clear all cache
  const clearAllCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  return {
    messages,
    setMessages,
    loading,
    fetchMessages,
    fetchSystemMessages,
    fetchTryoutMessages,
    addMessageToCache,
    clearCache,
    clearAllCache,
  };
};
