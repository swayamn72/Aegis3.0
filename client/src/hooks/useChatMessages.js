import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '../utils/axiosConfig';
import { chatKeys } from './queryKeys';

// API functions
const fetchDirectMessages = async (receiverId) => {
  const { data } = await axios.get(`/api/chat/${receiverId}`);
  return data;
};

const fetchSystemMessages = async () => {
  const { data } = await axios.get('/api/chat/system');
  return data;
};

const fetchTryoutMessages = async (chatId) => {
  const { data } = await axios.get(`/api/tryout-chats/${chatId}`);
  return data.chat;
};

export const useChatMessages = (chatId, chatType = 'direct') => {
  const queryClient = useQueryClient();

  // Direct messages query
  const directMessagesQuery = useQuery({
    queryKey: chatKeys.messages(chatId),
    queryFn: () => fetchDirectMessages(chatId),
    enabled: chatType === 'direct' && !!chatId && chatId !== 'system',
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // System messages query
  const systemMessagesQuery = useQuery({
    queryKey: chatKeys.systemMessages(),
    queryFn: fetchSystemMessages,
    enabled: chatType === 'direct' && chatId === 'system',
  });

  // Tryout messages query
  const tryoutMessagesQuery = useQuery({
    queryKey: chatKeys.tryoutMessages(chatId),
    queryFn: () => fetchTryoutMessages(chatId),
    enabled: chatType === 'tryout' && !!chatId,
    staleTime: 1 * 60 * 1000, // 1 minute for real-time data
  });

  // Select active query based on chat type
  const activeQuery = chatType === 'tryout'
    ? tryoutMessagesQuery
    : (chatId === 'system' ? systemMessagesQuery : directMessagesQuery);

  // Optimistic message update
  const addMessage = (newMessage) => {
    if (chatType === 'direct') {
      const queryKey = chatId === 'system'
        ? chatKeys.systemMessages()
        : chatKeys.messages(chatId);

      queryClient.setQueryData(queryKey, (old) => {
        return old ? [...old, newMessage] : [newMessage];
      });
    } else if (chatType === 'tryout') {
      queryClient.setQueryData(chatKeys.tryoutMessages(chatId), (old) => {
        if (!old) return { messages: [newMessage] };
        return {
          ...old,
          messages: [...(old.messages || []), newMessage]
        };
      });
    }
  };

  // Update message (replace temp ID with real ID)
  const updateMessage = (tempId, realMessage) => {
    const queryKey = chatType === 'tryout'
      ? chatKeys.tryoutMessages(chatId)
      : (chatId === 'system' ? chatKeys.systemMessages() : chatKeys.messages(chatId));

    queryClient.setQueryData(queryKey, (old) => {
      if (chatType === 'tryout') {
        return {
          ...old,
          messages: (old.messages || []).map(m =>
            m._id === tempId ? realMessage : m
          )
        };
      }
      return old ? old.map(m => m._id === tempId ? realMessage : m) : [realMessage];
    });
  };

  // Invalidate and refetch
  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: activeQuery.queryKey });
  };

  return {
    messages: chatType === 'tryout'
      ? activeQuery.data?.messages || []
      : activeQuery.data || [],
    selectedChat: chatType === 'tryout' ? activeQuery.data : null,
    loading: activeQuery.isLoading,
    error: activeQuery.error,
    isRefetching: activeQuery.isRefetching,
    addMessage,
    updateMessage,
    refetch,
  };
};
