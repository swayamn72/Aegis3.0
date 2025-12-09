import { useState, useCallback, useEffect, useRef } from 'react';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export const useChatData = (user) => {
    const [connections, setConnections] = useState([]);
    const [teamApplications, setTeamApplications] = useState([]);
    const [tryoutChats, setTryoutChats] = useState([]);
    const [recruitmentApproaches, setRecruitmentApproaches] = useState([]);
    const [loading, setLoading] = useState(true);

    // Debounce timer ref
    const debounceTimerRef = useRef(null);
    const confirmedConnectionsRef = useRef([]);

    // Fetch users with chat history
    const fetchConnections = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/api/chat/users/with-chats`, { credentials: 'include' });
            const data = await res.json();
            return data.users || [];
        } catch (error) {
            console.error('Error fetching chat users:', error);
            return [];
        }
    }, []);

    // Fetch team applications
    const fetchTeamApplications = useCallback(async () => {
        if (!user?.team?._id) return;

        try {
            const res = await fetch(`${API_URL}/api/team-applications/team/${user.team._id}`, {
                credentials: 'include'
            });
            const data = await res.json();
            setTeamApplications(data.applications || []);
        } catch (error) {
            console.error('Error fetching applications:', error);
        }
    }, [user?.team?._id]);

    // Fetch tryout chats
    const fetchTryoutChats = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/api/tryout-chats/my-chats`, { credentials: 'include' });
            const data = await res.json();
            setTryoutChats(data.chats || []);
        } catch (error) {
            console.error('Error fetching tryout chats:', error);
        }
    }, []);

    // Fetch recruitment approaches
    const fetchRecruitmentApproaches = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/api/recruitment/my-approaches`, { credentials: 'include' });
            const data = await res.json();
            setRecruitmentApproaches(data.approaches || []);
        } catch (error) {
            console.error('Error fetching recruitment approaches:', error);
        }
    }, []);

    // Combine connections (memoized logic)
    const combineConnections = useCallback((confirmedConns, teamApps) => {
        const combined = [...confirmedConns];

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
    }, []);

    // Debounced connection update
    const updateConnections = useCallback(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            const combined = combineConnections(confirmedConnectionsRef.current, teamApplications);
            setConnections(combined);
        }, 300);
    }, [teamApplications, combineConnections]);

    // Initial data fetch
    const fetchAllData = useCallback(async () => {
        setLoading(true);

        // Fetch all data in parallel
        const [conns] = await Promise.all([
            fetchConnections(),
            fetchTeamApplications(),
            fetchTryoutChats(),
            fetchRecruitmentApproaches()
        ]);

        confirmedConnectionsRef.current = conns;
        setLoading(false);
    }, [fetchConnections, fetchTeamApplications, fetchTryoutChats, fetchRecruitmentApproaches]);

    // Update connections when team applications change
    useEffect(() => {
        if (!loading) {
            updateConnections();
        }
    }, [teamApplications, loading, updateConnections]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    return {
        connections,
        teamApplications,
        tryoutChats,
        recruitmentApproaches,
        loading,
        fetchAllData,
        fetchTeamApplications,
        fetchTryoutChats,
        fetchRecruitmentApproaches,
        setConnections
    };
};
