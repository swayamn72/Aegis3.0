import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getConnections,
    getTeam,
    getPlayerPosts,
    updatePost,
    deletePost
} from '../api/profile';

// Connections Hook
export const useConnections = () => {
    return useQuery({
        queryKey: ['connections'],
        queryFn: getConnections,
        staleTime: 5 * 60 * 1000, // 5 minutes
        cacheTime: 10 * 60 * 1000, // 10 minutes
    });
};

// Team Hook
export const useTeam = (teamId) => {
    return useQuery({
        queryKey: ['team', teamId],
        queryFn: () => getTeam(teamId),
        enabled: !!teamId,
        staleTime: 10 * 60 * 1000, // 10 minutes
        cacheTime: 15 * 60 * 1000, // 15 minutes
    });
};

// Posts Hook
export const usePosts = (playerId) => {
    return useQuery({
        queryKey: ['posts', playerId],
        queryFn: () => getPlayerPosts({ playerId, includeMedia: true }),
        enabled: !!playerId,
        staleTime: 2 * 60 * 1000, // 2 minutes
        cacheTime: 5 * 60 * 1000, // 5 minutes
    });
};

// Update Post Mutation
export const useUpdatePost = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: updatePost,
        onSuccess: () => {
            // Invalidate and refetch posts
            queryClient.invalidateQueries({ queryKey: ['posts'] });
        },
        onError: (error) => {
            console.error('Error updating post:', error);
        }
    });
};

// Delete Post Mutation
export const useDeletePost = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deletePost,
        onSuccess: () => {
            // Invalidate and refetch posts
            queryClient.invalidateQueries({ queryKey: ['posts'] });
        },
        onError: (error) => {
            console.error('Error deleting post:', error);
        }
    });
};
