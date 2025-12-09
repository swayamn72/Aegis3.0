import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { toast } from 'react-toastify';

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
    setMessages,
    setSelectedChat,
    showNotification
}) => {
    const socket = getSocket();

    useEffect(() => {
        if (!userId) return;

        // Join user's personal room
        socket.emit('join', userId);

        // Direct message handler
        const handleReceiveMessage = (msg) => {
            if (chatType === 'direct' && selectedChatId &&
                (msg.senderId?.toString() === selectedChatId?.toString() ||
                    msg.receiverId?.toString() === selectedChatId?.toString() ||
                    (selectedChatId === 'system' && msg.messageType === 'system'))
            ) {
                setMessages((prev) => [...prev, msg]);
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
                setMessages((prev) => {
                    const messageExists = prev.some(m =>
                        m._id === data.message._id ||
                        (m._id?.toString().startsWith('temp_') &&
                            m.message === data.message.message &&
                            m.sender === data.message.sender)
                    );

                    if (messageExists) {
                        return prev.map(m =>
                            (m._id?.toString().startsWith('temp_') &&
                                m.message === data.message.message &&
                                m.sender === data.message.sender)
                                ? data.message : m
                        );
                    }
                    return [...prev, data.message];
                });
            }
        };

        // Tryout status handlers
        const handleTryoutEnded = (data) => {
            if (chatType === 'tryout' && selectedChatId && data.chatId === selectedChatId) {
                setSelectedChat((prev) => ({
                    ...prev,
                    tryoutStatus: data.tryoutStatus,
                    endedBy: data.endedBy,
                    endReason: data.reason
                }));
                if (data.message) setMessages(prev => [...prev, data.message]);
                toast.info('Tryout has been ended');
            }
        };

        const handleTeamOfferSent = (data) => {
            if (chatType === 'tryout' && selectedChatId && data.chatId === selectedChatId) {
                setSelectedChat((prev) => ({ ...prev, tryoutStatus: 'offer_sent', teamOffer: data.offer }));
                if (data.message) setMessages(prev => [...prev, data.message]);
                toast.success('Team offer received!');
            }
        };

        const handleTeamOfferAccepted = (data) => {
            if (chatType === 'tryout' && selectedChatId && data.chatId === selectedChatId) {
                setSelectedChat((prev) => ({ ...prev, tryoutStatus: 'offer_accepted' }));
                if (data.message) setMessages(prev => [...prev, data.message]);
                toast.success('Player joined the team!');
            }
        };

        const handleTeamOfferRejected = (data) => {
            if (chatType === 'tryout' && selectedChatId && data.chatId === selectedChatId) {
                setSelectedChat((prev) => ({ ...prev, tryoutStatus: 'offer_rejected' }));
                if (data.message) setMessages(prev => [...prev, data.message]);
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
    }, [userId, chatType, selectedChatId, setMessages, setSelectedChat, showNotification, socket]);

    return socket;
};
