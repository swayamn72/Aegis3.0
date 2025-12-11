import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import axios from '../utils/axiosConfig';
import { chatKeys } from './queryKeys';

// API functions
const fetchConnections = async () => {
    const { data } = await axios.get('/api/chat/users/with-chats');
    return data.users || [];
};

const fetchTeamApplications = async (teamId) => {
    if (!teamId) return [];
    const { data } = await axios.get(`/api/team-applications/team/${teamId}`);
    return data.applications || [];
};

const fetchTryoutChats = async () => {
    const { data } = await axios.get('/api/tryout-chats/my-chats');
    return data.chats || [];
};

const fetchRecruitmentApproaches = async () => {
    const { data } = await axios.get('/api/recruitment/my-approaches');
    return data.approaches || [];
};

export const useChatData = (user) => {
    const queryClient = useQueryClient();

    // Connections query
    const connectionsQuery = useQuery({
        queryKey: chatKeys.connections(),
        queryFn: fetchConnections,
        staleTime: 5 * 60 * 1000,
    });

    // Team applications query
    const applicationsQuery = useQuery({
        queryKey: chatKeys.teamApplications(user?.team?._id),
        queryFn: () => fetchTeamApplications(user?.team?._id),
        enabled: !!user?.team?._id,
        staleTime: 2 * 60 * 1000,
    });

    // Tryout chats query
    const tryoutChatsQuery = useQuery({
        queryKey: chatKeys.myTryouts(),
        queryFn: fetchTryoutChats,
        staleTime: 2 * 60 * 1000,
    });

    // Recruitment approaches query
    const approachesQuery = useQuery({
        queryKey: chatKeys.myApproaches(),
        queryFn: fetchRecruitmentApproaches,
        staleTime: 2 * 60 * 1000,
    });

    // Combine connections with team applications
    const connections = useMemo(() => {
        const confirmed = connectionsQuery.data || [];
        const teamApps = applicationsQuery.data || [];

        const combined = [...confirmed];

        // Add players from applications
        teamApps.forEach(app => {
            const exists = combined.some(conn => conn._id === app.player?._id);
            if (!exists && app.player) {
                combined.push(app.player);
            }
        });

        // Add system user
        const systemUser = {
            _id: 'system',
            username: 'System',
            realName: 'System Notifications',
            profilePicture: null
        };
        combined.unshift(systemUser);

        return combined;
    }, [connectionsQuery.data, applicationsQuery.data]);

    // Refetch functions
    const refetchConnections = () => {
        queryClient.invalidateQueries({ queryKey: chatKeys.connections() });
    };

    const refetchApplications = () => {
        queryClient.invalidateQueries({
            queryKey: chatKeys.teamApplications(user?.team?._id)
        });
    };

    const refetchTryouts = () => {
        queryClient.invalidateQueries({ queryKey: chatKeys.myTryouts() });
    };

    const refetchApproaches = () => {
        queryClient.invalidateQueries({ queryKey: chatKeys.myApproaches() });
    };

    const refetchAll = () => {
        refetchConnections();
        refetchApplications();
        refetchTryouts();
        refetchApproaches();
    };

    return {
        connections,
        teamApplications: applicationsQuery.data || [],
        tryoutChats: tryoutChatsQuery.data || [],
        recruitmentApproaches: approachesQuery.data || [],
        loading: connectionsQuery.isLoading ||
            applicationsQuery.isLoading ||
            tryoutChatsQuery.isLoading ||
            approachesQuery.isLoading,
        error: connectionsQuery.error ||
            applicationsQuery.error ||
            tryoutChatsQuery.error ||
            approachesQuery.error,
        refetchConnections,
        refetchApplications,
        refetchTryouts,
        refetchApproaches,
        refetchAll,
    };
};
