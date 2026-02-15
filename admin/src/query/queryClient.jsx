import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes - data considered fresh
            cacheTime: 10 * 60 * 1000, // 10 minutes - cache persistence
            refetchOnWindowFocus: false, // Don't refetch on window focus
            refetchOnReconnect: true, // Refetch on reconnect
            retry: 1, // Retry failed requests once
        },
    },
});
