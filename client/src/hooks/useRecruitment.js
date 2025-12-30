import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
    fetchLFTPosts,
    fetchLFPPosts,
    fetchRecruitingTeams,
    createLFTPost,
    createLFPPost,
    deleteLFPPost,
    approachPlayer,
    approachTeam,
} from '../api/recruitment';
import { recruitmentKeys } from './queryKeys';

// Hook to fetch LFT posts
export const useLFTPosts = (filters) => {
    return useQuery({
        queryKey: recruitmentKeys.lftPosts(filters),
        queryFn: () => fetchLFTPosts(filters),
        staleTime: 3 * 60 * 1000, // 3 minutes
        onError: (error) => {
            console.error('Error fetching LFT posts:', error);
            toast.error('Failed to load LFT posts');
        },
    });
};

// Hook to fetch LFP posts (Looking For Players)
export const useLFPPosts = (filters) => {
    return useQuery({
        queryKey: recruitmentKeys.lfpPosts(filters),
        queryFn: () => fetchLFPPosts(filters),
        staleTime: 3 * 60 * 1000, // 3 minutes
        onError: (error) => {
            console.error('Error fetching LFP posts:', error);
            toast.error('Failed to load LFP posts');
        },
    });
};

// Hook to fetch recruiting teams
export const useRecruitingTeams = (filters) => {
    return useQuery({
        queryKey: recruitmentKeys.recruitingTeams(filters),
        queryFn: () => fetchRecruitingTeams(filters),
        staleTime: 3 * 60 * 1000, // 3 minutes
        onError: (error) => {
            console.error('Error fetching teams:', error);
            toast.error('Failed to load teams');
        },
    });
};

// Hook to create LFT post
export const useCreateLFTPost = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createLFTPost,
        onSuccess: () => {
            // Invalidate all LFT posts queries to refetch
            queryClient.invalidateQueries({ queryKey: recruitmentKeys.all });
            toast.success('LFT post created successfully!');
        },
        onError: (error) => {
            console.error('Error creating LFT post:', error);
            toast.error(error.error || 'Failed to create LFT post');
        },
    });
};

// Hook to create LFP post (Looking For Players)
export const useCreateLFPPost = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createLFPPost,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: recruitmentKeys.all });
            toast.success('LFP post created successfully!');
        },
        onError: (error) => {
            console.error('Error creating LFP post:', error);
            toast.error(error.error || 'Failed to create LFP post');
        },
    });
};

// Hook to delete LFP post
export const useDeleteLFPPost = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteLFPPost,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: recruitmentKeys.all });
            toast.success('LFP post deleted successfully!');
        },
        onError: (error) => {
            console.error('Error deleting LFP post:', error);
            toast.error(error.error || 'Failed to delete LFP post');
        },
    });
};

// Hook to approach a player
export const useApproachPlayer = () => {
    return useMutation({
        mutationFn: ({ playerId, message }) => approachPlayer(playerId, message),
        onSuccess: () => {
            toast.success('Approach request sent! Player will be notified.');
        },
        onError: (error) => {
            console.error('Error approaching player:', error);
            toast.error(error.error || 'Failed to send approach');
        },
    });
};

// Hook to approach a team
export const useApproachTeam = () => {
    return useMutation({
        mutationFn: ({ teamId, message }) => approachTeam(teamId, message),
        onSuccess: () => {
            toast.success('Tryout request sent!');
        },
        onError: (error) => {
            console.error('Error approaching team:', error);
            toast.error(error.error || 'Failed to send tryout request');
        },
    });
};
