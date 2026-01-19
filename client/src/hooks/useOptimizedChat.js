import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { useSocket } from '../context/SocketContext';
import { chatKeys } from './queryKeys';

/**
 * Optimized hook for managing chat functionality with persistent socket
 * No more socket reconnections on chat switch - just room management!
 */
export const useOptimizedChat = ({
    userId,
    chatType, // 'direct' or 'tryout'
    selectedChatId,
    showNotification
}) => {
    const { isConnected, joinRoom, leaveRoom, on, sendMessage: socketSendMessage } = useSocket();
    const queryClient = useQueryClient();
    const currentChatRef = useRef(null);
    const cleanupFunctionsRef = useRef([]);

    // Track current chat
    useEffect(() => {
        currentChatRef.current = { chatType, selectedChatId };
    }, [chatType, selectedChatId]);

    // Handle room joining/leaving when chat changes
    useEffect(() => {
        if (!isConnected || !selectedChatId) return;

        console.log(`🔄 Switching to ${chatType} chat:`, selectedChatId);

        // Join the new room (leave is handled by cleanup)
        joinRoom(selectedChatId, chatType);

        // Cleanup: leave room when switching or unmounting
        return () => {
            console.log(`📤 Leaving ${chatType} chat:`, selectedChatId);
            leaveRoom(selectedChatId, chatType);
        };
    }, [isConnected, selectedChatId, chatType, joinRoom, leaveRoom]);

    // Set up event listeners
    useEffect(() => {
        if (!isConnected || !userId) return;

        console.log('👂 Setting up event listeners');

        // Clean up any previous listeners
        cleanupFunctionsRef.current.forEach(cleanup => cleanup());
        cleanupFunctionsRef.current = [];

        // Direct message handler
        const handleReceiveMessage = (msg) => {
            const current = currentChatRef.current;
            if (current.chatType === 'direct' && current.selectedChatId) {
                const queryKey = current.selectedChatId === 'system'
                    ? chatKeys.systemMessages()
                    : chatKeys.messages(current.selectedChatId);

                queryClient.setQueryData(queryKey, (old) => {
                    return old ? [...old, msg] : [msg];
                });
            }

            // Browser notification for tournament invites
            if (msg.messageType === 'tournament_invite' && msg.receiverId === userId) {
                showNotification?.(
                    'Tournament Invitation',
                    'Your team has been invited to participate in a tournament',
                    '/favicon.ico',
                    () => { window.location.href = `/chat?user=${msg.senderId}`; }
                );
            }
        };

        // Tryout message handlers
        const handleTryoutMessage = (data) => {
            const current = currentChatRef.current;
            if (current.chatType === 'tryout' && data.chatId === current.selectedChatId) {
                queryClient.setQueryData(chatKeys.tryoutMessages(current.selectedChatId), (old) => {
                    if (!old) return { messages: [data.message] };

                    const messages = old.messages || [];
                    const messageExists = messages.some(m =>
                        m._id === data.message._id ||
                        (m._id?.toString().startsWith('temp_') &&
                            m.message === data.message.message &&
                            m.sender === data.message.sender)
                    );

                    if (messageExists) {
                        return {
                            ...old,
                            messages: messages.map(m =>
                                (m._id?.toString().startsWith('temp_') &&
                                    m.message === data.message.message &&
                                    m.sender === data.message.sender)
                                    ? data.message : m
                            )
                        };
                    }
                    return {
                        ...old,
                        messages: [...messages, data.message]
                    };
                });
            }
        };

        const handleNewTryoutMessage = ({ message, chatId }) => {
            const current = currentChatRef.current;
            console.log('📩 NEW TRYOUT MESSAGE:', {
                messageId: message._id,
                sender: message.sender?.username || message.sender,
                currentChatId: current.selectedChatId,
                messageChatId: chatId
            });

            if (current.chatType === 'tryout' && chatId === current.selectedChatId) {
                queryClient.setQueryData(chatKeys.tryoutMessages(chatId), (old) => {
                    if (!old) return { messages: [message] };

                    const messages = old.messages || [];
                    const messageExists = messages.some(m => m._id === message._id);

                    if (messageExists) return old;

                    return {
                        ...old,
                        messages: [...messages, message]
                    };
                });
            }
        };

        // Tryout status handlers
        const handleTryoutEnded = (data) => {
            const current = currentChatRef.current;
            if (current.chatType === 'tryout' && data.chatId === current.selectedChatId) {
                queryClient.setQueryData(chatKeys.tryoutMessages(current.selectedChatId), (old) => {
                    if (!old) return old;
                    return {
                        ...old,
                        tryoutStatus: data.tryoutStatus,
                        endedBy: data.endedBy,
                        endReason: data.reason,
                        messages: data.message ? [...(old.messages || []), data.message] : old.messages
                    };
                });
                toast.info('Tryout has been ended');
            }
        };

        const handleTeamOfferSent = (data) => {
            const current = currentChatRef.current;
            if (current.chatType === 'tryout' && data.chatId === current.selectedChatId) {
                queryClient.setQueryData(chatKeys.tryoutMessages(current.selectedChatId), (old) => {
                    if (!old) return old;
                    return {
                        ...old,
                        tryoutStatus: 'offer_sent',
                        teamOffer: data.offer,
                        messages: data.message ? [...(old.messages || []), data.message] : old.messages
                    };
                });
                toast.success('Team offer received!');
            }
        };

        const handleTeamOfferAccepted = (data) => {
            const current = currentChatRef.current;
            if (current.chatType === 'tryout' && data.chatId === current.selectedChatId) {
                queryClient.setQueryData(chatKeys.tryoutMessages(current.selectedChatId), (old) => {
                    if (!old) return old;
                    return {
                        ...old,
                        tryoutStatus: 'offer_accepted',
                        messages: data.message ? [...(old.messages || []), data.message] : old.messages
                    };
                });
                toast.success('Player joined the team!');
            }
        };

        const handleTeamOfferRejected = (data) => {
            const current = currentChatRef.current;
            if (current.chatType === 'tryout' && data.chatId === current.selectedChatId) {
                queryClient.setQueryData(chatKeys.tryoutMessages(current.selectedChatId), (old) => {
                    if (!old) return old;
                    return {
                        ...old,
                        tryoutStatus: 'offer_rejected',
                        messages: data.message ? [...(old.messages || []), data.message] : old.messages
                    };
                });
                toast.info('Player declined the team offer');
            }
        };

        const handleTryoutChatJoined = ({ chatId }) => {
            console.log('✅ Successfully joined tryout room:', chatId);
        };

        // Register all listeners and store cleanup functions
        cleanupFunctionsRef.current = [
            on('receiveMessage', handleReceiveMessage),
            on('tryoutMessage', handleTryoutMessage),
            on('newTryoutMessage', handleNewTryoutMessage),
            on('tryoutChatJoined', handleTryoutChatJoined),
            on('tryoutEnded', handleTryoutEnded),
            on('teamOfferSent', handleTeamOfferSent),
            on('teamOfferAccepted', handleTeamOfferAccepted),
            on('teamOfferRejected', handleTeamOfferRejected)
        ];

        // Cleanup listeners on unmount or when dependencies change
        return () => {
            console.log('🧹 Cleaning up event listeners');
            cleanupFunctionsRef.current.forEach(cleanup => cleanup());
            cleanupFunctionsRef.current = [];
        };
    }, [isConnected, userId, queryClient, showNotification, on]);

    // Send message function
    const sendMessage = (message, additionalData = {}) => {
        if (!currentChatRef.current.selectedChatId) {
            console.error('❌ No chat selected');
            return false;
        }

        const messageData = {
            chatId: currentChatRef.current.selectedChatId,
            message,
            senderId: userId,
            ...additionalData
        };

        return socketSendMessage(currentChatRef.current.chatType, messageData);
    };

    return {
        isConnected,
        sendMessage,
        currentChat: currentChatRef.current
    };
};
