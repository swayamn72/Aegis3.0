import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchPlayers } from '../api/players';

export const usePlayersQuery = () => {
    return useInfiniteQuery({
        queryKey: ['players'],
        queryFn: ({ pageParam = 0 }) => fetchPlayers({ limit: 20, skip: pageParam }),
        getNextPageParam: (lastPage) => {
            return lastPage.hasMore ? lastPage.nextSkip : undefined;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        cacheTime: 10 * 60 * 1000, // 10 minutes
    });
};
