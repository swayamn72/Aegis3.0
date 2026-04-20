import axiosInstance from '../utils/axiosConfig';

export const fetchIncomingMessageRequests = async () => {
    const { data } = await axiosInstance.get('/api/chat/requests/incoming');
    return data.requests || [];
};

export const fetchOutgoingMessageRequests = async () => {
    const { data } = await axiosInstance.get('/api/chat/requests/outgoing');
    return data.requests || [];
};

export const fetchMessageRequestRelationship = async (targetUserId) => {
    const { data } = await axiosInstance.get(`/api/chat/requests/relationship/${targetUserId}`);
    return data;
};

export const sendMessageRequest = async (targetUserId, initialMessage = '') => {
    const { data } = await axiosInstance.post(`/api/chat/requests/${targetUserId}`, {
        initialMessage,
    });
    return data;
};

export const updateMessageRequest = async (requestId, action) => {
    const { data } = await axiosInstance.patch(`/api/chat/requests/${requestId}`, { action });
    return data;
};
