import { useQuery } from '@tanstack/react-query';
import axios from '../utils/axiosConfig';
import { chatKeys } from './queryKeys';

export const useChatMessages = (chatId, chatType) => {
  // Direct messages
  const { data: directMessages = [], refetch: refetchDirect, isLoading: loadingDirect } = useQuery({
    queryKey: chatKeys.messages(chatId),
    queryFn: async () => {
      if (!chatId) return [];
      const { data } = await axios.get(`/api/chat/messages/${chatId}`);
      return data.messages || [];
    },
    enabled: chatType === 'direct' && !!chatId,
    staleTime: 30 * 1000, // ✅ 30 seconds
    refetchOnWindowFocus: false, // ✅ Don't refetch on focus
    refetchInterval: false, // ✅ Don't poll
    // ✅ ADD: Notify components when cache changes
    notifyOnChangeProps: 'all',
  });

  // Tryout messages
  const { data: tryoutChat, refetch: refetchTryout, isLoading: loadingTryout } = useQuery({
    queryKey: chatKeys.tryoutMessages(chatId),
    queryFn: async () => {
      if (!chatId) return null;
      const { data } = await axios.get(`/api/tryout-chats/${chatId}`);
      return data.chat || null;
    },
    enabled: chatType === 'tryout' && !!chatId,
    staleTime: 30 * 1000, // ✅ 30 seconds
    refetchOnWindowFocus: false, // ✅ Don't refetch on focus
    refetchInterval: false, // ✅ Don't poll
    // ✅ ADD: Notify components when cache changes
    notifyOnChangeProps: 'all',
    // ✅ ADD: Keep previous data while refetching
    keepPreviousData: true,
  });

  return {
    messages: chatType === 'direct' ? directMessages : (tryoutChat?.messages || []),
    selectedChat: chatType === 'tryout' ? tryoutChat : null,
    loading: chatType === 'direct' ? loadingDirect : loadingTryout,
    refetch: chatType === 'direct' ? refetchDirect : refetchTryout,
  };
};
