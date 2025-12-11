import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import axios from '../utils/axiosConfig';
import { chatKeys } from './queryKeys';

export const useChatData = (user) => {
    const enabled = !!user?._id;

    const { data: connections = [], refetch: refetchConnections } = useQuery({
        queryKey: chatKeys.connections(),
        queryFn: async () => {
            const { data } = await axios.get('/api/chat/users/with-chats');
            return data.users || [];
        },
        enabled,
        staleTime: 5 * 60 * 1000, // ✅ Increase to 5 minutes
        refetchOnWindowFocus: false, // ✅ Don't refetch on focus
    });

    const { data: tryoutChats = [], refetch: refetchTryouts } = useQuery({
        queryKey: chatKeys.myTryouts(),
        queryFn: async () => {
            const { data } = await axios.get('/api/tryout-chats/my-chats');
            return data.chats || [];
        },
        enabled,
        staleTime: 5 * 60 * 1000, // ✅ Increase to 5 minutes
        refetchOnWindowFocus: false,
    });

    const { data: teamApplications = [], refetch: refetchApplications } = useQuery({
        queryKey: chatKeys.teamApplications(user?.team?._id),
        queryFn: async () => {
            if (!user?.team?._id) return [];
            const { data } = await axios.get(`/api/team-applications/team/${user.team._id}`);
            return data.applications || [];
        },
        enabled: enabled && !!user?.team?._id,
        staleTime: 5 * 60 * 1000, // ✅ Increase to 5 minutes
        refetchOnWindowFocus: false,
    });

    const { data: recruitmentApproaches = [], refetch: refetchApproaches } = useQuery({
        queryKey: chatKeys.myApproaches(),
        queryFn: async () => {
            const { data } = await axios.get('/api/recruitment/my-approaches');
            return data.approaches || [];
        },
        enabled,
        staleTime: 5 * 60 * 1000, // ✅ Increase to 5 minutes
        refetchOnWindowFocus: false,
    });

    const refetchAll = useCallback(() => {
        refetchConnections();
        refetchTryouts();
        refetchApplications();
        refetchApproaches();
    }, [refetchConnections, refetchTryouts, refetchApplications, refetchApproaches]);

    return {
        connections,
        tryoutChats,
        teamApplications,
        recruitmentApproaches,
        loading: false,
        refetchAll,
        refetchConnections,
        refetchTryouts,
        refetchApplications,
        refetchApproaches,
    };
};
