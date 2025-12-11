import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { toast } from 'react-toastify';
import { chatKeys } from './queryKeys';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

// Singleton socket instance
let socketInstance = null;

export const getSocket = () => {
    if (!socketInstance) {
        socketInstance = io(API_URL, { withCredentials: true });
    }
    return socketInstance;
};

export const useChatSocket = ({
    userId,
    chatType,
    selectedChatId,
    showNotification
}) => {
    const socket = getSocket();
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!userId) return;

        // Join user's personal room
        socket.emit('join', userId);

        // Direct message handler
        const handleReceiveMessage = (msg) => {
            if (chatType === 'direct' && selectedChatId) {
                const queryKey = selectedChatId === 'system'
                    ? chatKeys.systemMessages()
                    : chatKeys.messages(selectedChatId);

                // Update cache with new message
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

        // Tryout message handler
        const handleTryoutMessage = (data) => {
            if (chatType === 'tryout' && selectedChatId && data.chatId === selectedChatId) {
                queryClient.setQueryData(chatKeys.tryoutMessages(selectedChatId), (old) => {
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

        // Tryout status handlers
        const handleTryoutEnded = (data) => {
            if (chatType === 'tryout' && selectedChatId && data.chatId === selectedChatId) {
                queryClient.setQueryData(chatKeys.tryoutMessages(selectedChatId), (old) => {
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
            if (chatType === 'tryout' && selectedChatId && data.chatId === selectedChatId) {
                queryClient.setQueryData(chatKeys.tryoutMessages(selectedChatId), (old) => {
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
            if (chatType === 'tryout' && selectedChatId && data.chatId === selectedChatId) {
                queryClient.setQueryData(chatKeys.tryoutMessages(selectedChatId), (old) => {
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
            if (chatType === 'tryout' && selectedChatId && data.chatId === selectedChatId) {
                queryClient.setQueryData(chatKeys.tryoutMessages(selectedChatId), (old) => {
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

        // Register all listeners
        socket.on('receiveMessage', handleReceiveMessage);
        socket.on('tryoutMessage', handleTryoutMessage);
        socket.on('tryoutEnded', handleTryoutEnded);
        socket.on('teamOfferSent', handleTeamOfferSent);
        socket.on('teamOfferAccepted', handleTeamOfferAccepted);
        socket.on('teamOfferRejected', handleTeamOfferRejected);

        // Cleanup
        return () => {
            socket.off('receiveMessage', handleReceiveMessage);
            socket.off('tryoutMessage', handleTryoutMessage);
            socket.off('tryoutEnded', handleTryoutEnded);
            socket.off('teamOfferSent', handleTeamOfferSent);
            socket.off('teamOfferAccepted', handleTeamOfferAccepted);
            socket.off('teamOfferRejected', handleTeamOfferRejected);
        };
    }, [userId, chatType, selectedChatId, showNotification, socket, queryClient]);

    return socket;
};
