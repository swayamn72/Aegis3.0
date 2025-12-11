import { useEffect, useRef } from 'react';
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
    const socketRef = useRef(null);

    useEffect(() => {
        if (!userId) return;

        socketRef.current = io(API_URL, {
            withCredentials: true,
            transports: ['websocket', 'polling']
        });

        socketRef.current.on('connect', () => {
            console.log('Socket connected');
            socketRef.current.emit('joinRoom', userId);
        });

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
        socketRef.current.on('receiveMessage', handleReceiveMessage);
        socketRef.current.on('tryoutMessage', handleTryoutMessage);
        socketRef.current.on('tryoutEnded', handleTryoutEnded);
        socketRef.current.on('teamOfferSent', handleTeamOfferSent);
        socketRef.current.on('teamOfferAccepted', handleTeamOfferAccepted);
        socketRef.current.on('teamOfferRejected', handleTeamOfferRejected);

        // Cleanup
        return () => {
            socketRef.current.off('receiveMessage', handleReceiveMessage);
            socketRef.current.off('tryoutMessage', handleTryoutMessage);
            socketRef.current.off('tryoutEnded', handleTryoutEnded);
            socketRef.current.off('teamOfferSent', handleTeamOfferSent);
            socketRef.current.off('teamOfferAccepted', handleTeamOfferAccepted);
            socketRef.current.off('teamOfferRejected', handleTeamOfferRejected);
            socketRef.current.disconnect();
        };
    }, [userId, chatType, selectedChatId, showNotification, socket, queryClient]);

    return socket;
};

// ✅ NEW: Tryout chat socket hook
export const useTryoutChatSocket = (chatId, userId, onMessageReceived, onTryoutEvent) => {
    const socketRef = useRef(null);
    const onMessageReceivedRef = useRef(onMessageReceived);
    const onTryoutEventRef = useRef(onTryoutEvent);

    useEffect(() => {
        onMessageReceivedRef.current = onMessageReceived;
        onTryoutEventRef.current = onTryoutEvent;
    }, [onMessageReceived, onTryoutEvent]);

    useEffect(() => {
        if (!chatId || !userId) {
            console.log('⏸️ Skipping socket - missing chatId or userId');
            return;
        }

        console.log('🔌 Connecting tryout socket for chat:', chatId);

        socketRef.current = io(API_URL, {
            withCredentials: true,
            transports: ['websocket', 'polling']
        });

        socketRef.current.on('connect', () => {
            console.log('✅ Tryout socket CONNECTED, ID:', socketRef.current.id);
            socketRef.current.emit('joinRoom', userId);
            socketRef.current.emit('joinTryoutChat', chatId);
        });

        socketRef.current.on('tryoutChatJoined', ({ chatId: joinedChatId }) => {
            console.log(`✅ Joined tryout room: ${joinedChatId}`);
        });

        socketRef.current.on('newTryoutMessage', ({ message, chatId: msgChatId }) => {
            console.log('📩 NEW MESSAGE RECEIVED:', {
                messageId: message._id,
                sender: message.sender?.username || message.sender,
                text: message.message,
                chatId: msgChatId
            });

            if (onMessageReceivedRef.current) {
                console.log('📤 Calling onMessageReceived callback');
                onMessageReceivedRef.current(message);
            } else {
                console.warn('⚠️ No onMessageReceived callback set!');
            }
        });

        // ✅ Listen for tryout events using refs
        socketRef.current.on('tryoutEnded', (data) => {
            console.log('Tryout ended:', data);
            if (onTryoutEventRef.current) {
                onTryoutEventRef.current('ended', data);
            }
        });

        socketRef.current.on('teamOfferSent', (data) => {
            console.log('Team offer sent:', data);
            if (onTryoutEventRef.current) {
                onTryoutEventRef.current('offerSent', data);
            }
        });

        socketRef.current.on('teamOfferAccepted', (data) => {
            console.log('Team offer accepted:', data);
            if (onTryoutEventRef.current) {
                onTryoutEventRef.current('offerAccepted', data);
            }
        });

        socketRef.current.on('teamOfferRejected', (data) => {
            console.log('Team offer rejected:', data);
            if (onTryoutEventRef.current) {
                onTryoutEventRef.current('offerRejected', data);
            }
        });

        socketRef.current.on('error', (error) => {
            console.error('❌ Socket error:', error);
        });

        return () => {
            console.log('🔌 Disconnecting tryout socket for chat:', chatId);
            if (socketRef.current) {
                socketRef.current.emit('leaveTryoutChat', chatId);
                socketRef.current.disconnect();
            }
        };
    }, [chatId, userId]);

    // ✅ Send message function
    const sendMessage = (message) => {
        if (socketRef.current && socketRef.current.connected) {
            console.log('📤 Sending message via socket:', message);
            socketRef.current.emit('sendTryoutMessage', {
                chatId,
                message,
                senderId: userId
            });
        } else {
            console.error('❌ Socket not connected, cannot send message');
        }
    };

    return { socket: socketRef.current, sendMessage };
};
