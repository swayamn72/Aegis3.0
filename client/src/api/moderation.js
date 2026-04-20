import axiosInstance from '../utils/axiosConfig';

export const getRelationshipStatus = async (targetUserId) => {
    const { data } = await axiosInstance.get(`/api/moderation/relationship/${targetUserId}`);
    return data;
};

export const blockUser = async (targetUserId, reason = '') => {
    const { data } = await axiosInstance.post(`/api/moderation/block/${targetUserId}`, { reason });
    return data;
};

export const unblockUser = async (targetUserId) => {
    const { data } = await axiosInstance.delete(`/api/moderation/block/${targetUserId}`);
    return data;
};

export const reportUser = async ({
    targetUserId,
    reason,
    details = '',
    messageId = null,
    chatType = 'unknown',
}) => {
    const { data } = await axiosInstance.post('/api/moderation/report/user', {
        targetUserId,
        reason,
        details,
        messageId,
        chatType,
    });
    return data;
};
