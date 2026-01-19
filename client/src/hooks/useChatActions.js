import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { useSocket } from '../context/SocketContext';
import axios from '../utils/axiosConfig';
import { chatKeys } from './queryKeys';

export const useChatActions = ({ userId, selectedChat, chatType }) => {
    const [showEndTryoutModal, setShowEndTryoutModal] = useState(false);
    const [showOfferModal, setShowOfferModal] = useState(false);
    const [endReason, setEndReason] = useState('');
    const [offerMessage, setOfferMessage] = useState('');
    const { emit, isConnected } = useSocket();
    const queryClient = useQueryClient();

    // Start tryout mutation
    const startTryoutMutation = useMutation({
        mutationFn: async (applicationId) => {
            const { data } = await axios.post(`/api/team-applications/${applicationId}/start-tryout`);
            return data;
        },
        onSuccess: (data) => {
            toast.success('Tryout started!');
            queryClient.invalidateQueries({ queryKey: chatKeys.applications() });
            queryClient.invalidateQueries({ queryKey: chatKeys.myTryouts() });
        },
        onError: (error) => {
            toast.error(error.error || 'Failed to start tryout');
        },
    });

    // End tryout mutation
    const endTryoutMutation = useMutation({
        mutationFn: async ({ chatId, reason }) => {
            const { data } = await axios.post(`/api/tryout-chats/${chatId}/end-tryout`, { reason });
            return data;
        },
        onSuccess: () => {
            toast.success('Tryout ended successfully');
            setShowEndTryoutModal(false);
            setEndReason('');
            queryClient.invalidateQueries({
                queryKey: chatKeys.tryoutMessages(selectedChat?._id)
            });
        },
        onError: (error) => {
            toast.error(error.error || 'Failed to end tryout');
        },
    });

    // Send offer mutation
    const sendOfferMutation = useMutation({
        mutationFn: async ({ chatId, message }) => {
            const { data } = await axios.post(`/api/tryout-chats/${chatId}/send-offer`, { message });
            return data;
        },
        onSuccess: () => {
            toast.success('Team offer sent!');
            setShowOfferModal(false);
            setOfferMessage('');
            queryClient.invalidateQueries({
                queryKey: chatKeys.tryoutMessages(selectedChat?._id)
            });
        },
        onError: (error) => {
            toast.error(error.error || 'Failed to send offer');
        },
    });

    // Accept offer mutation
    const acceptOfferMutation = useMutation({
        mutationFn: async (chatId) => {
            const { data } = await axios.post(`/api/tryout-chats/${chatId}/accept-offer`);
            return data;
        },
        onSuccess: (data) => {
            toast.success('You joined the team!');
            return data;
        },
        onError: (error) => {
            toast.error(error.error || 'Failed to accept offer');
        },
    });

    // Reject offer mutation
    const rejectOfferMutation = useMutation({
        mutationFn: async ({ chatId, reason }) => {
            const { data } = await axios.post(`/api/tryout-chats/${chatId}/reject-offer`, { reason });
            return data;
        },
        onSuccess: () => {
            toast.info('Team offer declined');
            queryClient.invalidateQueries({
                queryKey: chatKeys.tryoutMessages(selectedChat?._id)
            });
        },
        onError: (error) => {
            toast.error(error.error || 'Failed to reject offer');
        },
    });

    // Reject application mutation
    const rejectApplicationMutation = useMutation({
        mutationFn: async (applicationId) => {
            await axios.post(`/api/team-applications/${applicationId}/reject`, {
                reason: 'Not suitable at this time'
            });
        },
        onSuccess: () => {
            toast.success('Application rejected');
            queryClient.invalidateQueries({ queryKey: chatKeys.applications() });
        },
        onError: (error) => {
            toast.error(error.error || 'Failed to reject application');
        },
    });

    // Accept invitation mutation
    const acceptInvitationMutation = useMutation({
        mutationFn: async (invitationId) => {
            await axios.post(`/api/teams/invitations/${invitationId}/accept`);
            return invitationId;
        },
        onSuccess: (invitationId) => {
            toast.success('Invitation accepted successfully!');
            // Update all message caches
            queryClient.setQueriesData({ queryKey: chatKeys.all }, (oldData) => {
                if (Array.isArray(oldData)) {
                    return oldData.map(m =>
                        m.invitationId === invitationId || m.invitationId?._id === invitationId
                            ? { ...m, invitationStatus: 'accepted' }
                            : m
                    );
                }
                return oldData;
            });
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to accept invitation');
        },
    });

    // Decline invitation mutation
    const declineInvitationMutation = useMutation({
        mutationFn: async (invitationId) => {
            await axios.post(`/api/teams/invitations/${invitationId}/decline`);
            return invitationId;
        },
        onSuccess: (invitationId) => {
            toast.success('Invitation declined');
            queryClient.setQueriesData({ queryKey: chatKeys.all }, (oldData) => {
                if (Array.isArray(oldData)) {
                    return oldData.map(m =>
                        m.invitationId === invitationId
                            ? { ...m, invitationStatus: 'declined' }
                            : m
                    );
                }
                return oldData;
            });
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to decline invitation');
        },
    });

    // Accept approach mutation
    const acceptApproachMutation = useMutation({
        mutationFn: async (approachId) => {
            const { data } = await axios.post(`/api/recruitment/approach/${approachId}/accept`);
            return data;
        },
        onSuccess: (data) => {
            toast.success('Approach accepted! Tryout chat created.');
            queryClient.invalidateQueries({ queryKey: chatKeys.myApproaches() });
            queryClient.invalidateQueries({ queryKey: chatKeys.myTryouts() });
            return data;
        },
        onError: (error) => {
            toast.error(error.error || 'Failed to accept approach');
        },
    });

    // Reject approach mutation
    const rejectApproachMutation = useMutation({
        mutationFn: async (approachId) => {
            await axios.post(`/api/recruitment/approach/${approachId}/reject`, {
                reason: 'Not interested at this time'
            });
        },
        onSuccess: () => {
            toast.success('Approach rejected');
            queryClient.invalidateQueries({ queryKey: chatKeys.myApproaches() });
        },
        onError: () => {
            toast.error('Failed to reject approach');
        },
    });

    // Send message handler (optimistic update)
    const sendMessage = useCallback((input, clearInput) => {
        if (!input.trim() || !selectedChat || !userId) return;

        if (chatType === 'tryout') {
            const restrictedStatuses = ['ended_by_team', 'ended_by_player', 'offer_sent', 'offer_accepted', 'offer_rejected'];
            if (restrictedStatuses.includes(selectedChat.tryoutStatus)) {
                toast.error('This tryout has ended. No new messages can be sent.');
                return;
            }
        }

        if (chatType === 'direct') {
            const msg = {
                senderId: userId,
                receiverId: selectedChat._id,
                message: input,
                messageType: 'text',
                timestamp: new Date(),
            };

            // Optimistic update
            const queryKey = selectedChat._id === 'system'
                ? chatKeys.systemMessages()
                : chatKeys.messages(selectedChat._id);

            queryClient.setQueryData(queryKey, (old) => {
                return old ? [...old, msg] : [msg];
            });

            // Save to database via HTTP POST (this will also emit via socket on server)
            axios.post('/api/chat/send-notification', {
                receiverId: selectedChat._id,
                message: input,
                messageType: 'text'
            })
                .then(() => {
                    console.log('✅ Message saved to database');
                })
                .catch((error) => {
                    console.error('Failed to save message:', error);
                    toast.error('Failed to send message');
                    // Remove optimistic update on failure
                    queryClient.setQueryData(queryKey, (old) => {
                        return old ? old.filter(m => m.timestamp !== msg.timestamp) : old;
                    });
                });

            clearInput?.();
        } else if (chatType === 'tryout') {
            const tempId = `temp_${Date.now()}_${Math.random()}`;
            const optimisticMessage = {
                _id: tempId,
                sender: userId,
                message: input,
                messageType: 'text',
                timestamp: new Date()
            };

            // Optimistic update
            queryClient.setQueryData(chatKeys.tryoutMessages(selectedChat._id), (old) => {
                if (!old) return { messages: [optimisticMessage] };
                return {
                    ...old,
                    messages: [...(old.messages || []), optimisticMessage]
                };
            });

            if (!isConnected) {
                console.error('Socket not connected');
                toast.error('Connection lost. Please refresh.');
                return;
            }

            const success = emit('sendTryoutMessage', {
                chatId: selectedChat._id,
                senderId: userId,
                message: input
            });

            if (!success) {
                console.error('Failed to emit tryoutMessage');
                toast.error('Failed to send message');
            }
        }

        clearInput?.();
    }, [userId, selectedChat, chatType, emit, isConnected, queryClient]);

    // Wrapper functions that handle callbacks
    const handleStartTryout = (applicationId, callbacks) => {
        startTryoutMutation.mutate(applicationId, {
            onSuccess: (data) => {
                callbacks?.onSuccess?.(data);
            }
        });
    };

    const handleRejectApplication = (applicationId, callbacks) => {
        rejectApplicationMutation.mutate(applicationId, {
            onSuccess: () => {
                callbacks?.onSuccess?.();
            }
        });
    };

    const handleAcceptApproach = (approachId, callbacks) => {
        acceptApproachMutation.mutate(approachId, {
            onSuccess: (data) => {
                callbacks?.onSuccess?.(data);
            }
        });
    };

    const handleRejectApproach = (approachId, callbacks) => {
        rejectApproachMutation.mutate(approachId, {
            onSuccess: () => {
                callbacks?.onSuccess?.();
            }
        });
    };

    return {
        sendMessage,
        handleStartTryout,
        handleEndTryout: () => endTryoutMutation.mutate({
            chatId: selectedChat?._id,
            reason: endReason
        }),
        handleSendOffer: () => sendOfferMutation.mutate({
            chatId: selectedChat?._id,
            message: offerMessage
        }),
        handleAcceptOffer: (navigate) => {
            acceptOfferMutation.mutate(selectedChat?._id, {
                onSuccess: (data) => {
                    setTimeout(() => navigate(`/team/${data.team._id}`), 2000);
                }
            });
        },
        handleRejectOffer: () => {
            const reason = prompt('Reason for declining (optional):');
            rejectOfferMutation.mutate({ chatId: selectedChat?._id, reason });
        },
        handleRejectApplication,
        handleAcceptInvitation: acceptInvitationMutation.mutate,
        handleDeclineInvitation: declineInvitationMutation.mutate,
        handleAcceptTournamentInvite: acceptInvitationMutation.mutate,
        handleDeclineTournamentInvite: declineInvitationMutation.mutate,
        handleAcceptApproach,
        handleRejectApproach,
        // Modal states
        showEndTryoutModal,
        setShowEndTryoutModal,
        showOfferModal,
        setShowOfferModal,
        endReason,
        setEndReason,
        offerMessage,
        setOfferMessage,
        // Loading states
        isStartingTryout: startTryoutMutation.isPending,
        isEndingTryout: endTryoutMutation.isPending,
        isSendingOffer: sendOfferMutation.isPending,
    };
};
