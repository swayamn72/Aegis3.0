import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import {
    getTeam,
    getPlayerPosts,
    updatePost,
    deletePost
} from '../api/profile';
import { fetchPlayerMatches, fetchPlayerTournaments } from '../api/playerMatches';

// ─── Team ─────────────────────────────────────────────────────────────────────

export const useTeam = (teamId) => {
    return useQuery({
        queryKey: ['team', teamId],
        queryFn: () => getTeam(teamId),
        enabled: !!teamId,
        staleTime: 10 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
    });
};

// ─── Posts ────────────────────────────────────────────────────────────────────

export const usePosts = (playerId) => {
    return useQuery({
        queryKey: ['posts', playerId],
        queryFn: () => getPlayerPosts({ playerId, includeMedia: true }),
        enabled: !!playerId,
        staleTime: 2 * 60 * 1000,
        gcTime: 5 * 60 * 1000,
    });
};

// ─── Match History (infinite / paginated) ─────────────────────────────────────

export const usePlayerMatches = (playerId, limit = 10) => {
    return useInfiniteQuery({
        queryKey: ['playerMatches', playerId],
        queryFn: ({ pageParam = 1 }) =>
            fetchPlayerMatches({ playerId, page: pageParam, limit }),
        getNextPageParam: (lastPage) =>
            lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
        enabled: !!playerId,
        staleTime: 2 * 60 * 1000,   // 2 min — matches can update while tab is open
        gcTime: 10 * 60 * 1000,
    });
};

// ─── Tournament History (infinite / paginated) ────────────────────────────────

export const usePlayerTournaments = (playerId, limit = 5) => {
    return useInfiniteQuery({
        queryKey: ['playerTournaments', playerId],
        queryFn: ({ pageParam = 1 }) =>
            fetchPlayerTournaments({ playerId, page: pageParam, limit }),
        getNextPageParam: (lastPage) =>
            lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
        enabled: !!playerId,
        staleTime: 5 * 60 * 1000,   // 5 min — tournament history changes infrequently
        gcTime: 15 * 60 * 1000,
    });
};

// ─── Post mutations ───────────────────────────────────────────────────────────

export const useUpdatePost = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: updatePost,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['posts'] }),
        onError: (error) => console.error('Error updating post:', error),
    });
};

export const useDeletePost = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deletePost,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['posts'] }),
        onError: (error) => console.error('Error deleting post:', error),
    });
};
