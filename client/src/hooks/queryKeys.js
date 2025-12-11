export const chatKeys = {
    all: ['chat'],

    // Direct messages
    messages: (receiverId) => [...chatKeys.all, 'messages', receiverId],
    systemMessages: () => [...chatKeys.all, 'system'],
    connections: () => [...chatKeys.all, 'connections'],

    // Tryout chats
    tryouts: () => [...chatKeys.all, 'tryouts'],
    tryoutMessages: (chatId) => [...chatKeys.tryouts(), chatId],
    myTryouts: () => [...chatKeys.tryouts(), 'my-chats'],

    // Applications
    applications: () => [...chatKeys.all, 'applications'],
    teamApplications: (teamId) => [...chatKeys.applications(), 'team', teamId],

    // Recruitment
    recruitment: () => [...chatKeys.all, 'recruitment'],
    myApproaches: () => [...chatKeys.recruitment(), 'my-approaches'],

    // Tournaments
    tournaments: () => [...chatKeys.all, 'tournaments'],
    tournament: (tournamentId) => [...chatKeys.tournaments(), tournamentId],
};

export const recruitmentKeys = {
    all: ['recruitment'],

    // LFT Posts - serialize filters to avoid reference issues
    lftPosts: (filters) => [
        ...recruitmentKeys.all, 
        'lft-posts', 
        filters.game || 'all',
        filters.region || 'all', 
        filters.role || 'all'
    ],

    // Recruiting Teams - serialize filters to avoid reference issues
    recruitingTeams: (filters) => [
        ...recruitmentKeys.all, 
        'recruiting-teams',
        filters.game || 'all',
        filters.region || 'all',
        filters.role || 'all'
    ],
};
