import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30 * 1000, // ✅ 30 seconds (was 5 minutes)
            cacheTime: 10 * 60 * 1000, // 10 minutes
            refetchOnWindowFocus: false, // ✅ Prevent refetch on window focus
            refetchOnReconnect: true,
            refetchOnMount: false, // ✅ Prevent refetch on mount
            retry: 1,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        },
        mutations: {
            retry: 1,
        },
    },
});
