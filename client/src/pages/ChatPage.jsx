import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useQuery } from '@tanstack/react-query';
import { useAuth } from "../context/AuthContext";
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Send, Search, MoreVertical, Settings, Users, Hash, Activity, Crown, Shield, Gamepad2, Bell, Check, X, UserPlus,
  AlertCircle, Ban, CheckCircle, XCircle
} from 'lucide-react';
import ChatMessage from '../components/ChatMessage';
import { useChatSocket } from '../hooks/useChatSocket';
import { useChatMessages } from '../hooks/useChatMessages';
import { useChatData } from '../hooks/useChatData';
import { useChatActions } from '../hooks/useChatActions';
import { chatKeys } from '../hooks/queryKeys';
import axios from '../utils/axiosConfig';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export default function ChatPage() {
  const { user } = useAuth();
  const userId = user?._id;
  const location = useLocation();
  const navigate = useNavigate();
  const selectedUserId = location.state?.selectedUserId;

  // State
  const [selectedChat, setSelectedChat] = useState(null);
  const [chatType, setChatType] = useState('direct');
  const [input, setInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [showApplications, setShowApplications] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  // Refs
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // React Query Hooks
  const {
    messages,
    selectedChat: tryoutChatData,
    loading: messagesLoading,
    refetch: refetchCurrentMessages,
  } = useChatMessages(selectedChat?._id, chatType);

  const {
    connections,
    teamApplications,
    tryoutChats,
    recruitmentApproaches,
    loading: dataLoading,
    refetchAll,
    refetchApplications,
    refetchTryouts,
    refetchApproaches,
  } = useChatData(user);

  // Tournament details query
  const { data: tournamentDetails } = useQuery({
    queryKey: chatKeys.tournaments(),
    queryFn: async () => {
      const tournamentIds = messages
        .filter(m => m.messageType === 'tournament_reference' && m.tournamentId)
        .map(m => m.tournamentId);

      const uniqueIds = [...new Set(tournamentIds)];
      const results = await Promise.all(
        uniqueIds.map(id => axios.get(`/api/tournaments/${id}`).then(r => r.data))
      );

      return results.reduce((acc, data, i) => {
        acc[uniqueIds[i]] = data;
        return acc;
      }, {});
    },
    enabled: messages.some(m => m.messageType === 'tournament_reference'),
  });

  // Update selectedChat when tryout data changes
  useEffect(() => {
    if (chatType === 'tryout' && tryoutChatData) {
      setSelectedChat(tryoutChatData);
    }
  }, [tryoutChatData, chatType]);

  const showNotification = useCallback((title, body, icon, onClick) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, { body, icon, tag: 'tournament-invite' });
      if (onClick) {
        notification.onclick = () => { onClick(); notification.close(); };
      }
      setTimeout(() => notification.close(), 5000);
    }
  }, []);

  useChatSocket({
    userId,
    chatType,
    selectedChatId: selectedChat?._id,
    showNotification
  });

  const actions = useChatActions({
    userId,
    selectedChat,
    chatType,
  });

  // Scroll handling
  const handleScroll = useCallback((e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 50;
    setAutoScroll(isAtBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [autoScroll]);

  // Initial data fetch
  useEffect(() => {
    if (!userId) return;
    refetchAll();

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [userId, refetchAll]);

  // Auto-select first chat
  useEffect(() => {
    if (connections.length > 0 && !selectedChat) {
      if (selectedUserId) {
        const user = connections.find(c => c._id === selectedUserId);
        if (user) {
          setSelectedChat(user);
          setChatType('direct');
          return;
        }
      }
      setSelectedChat(connections[0]);
      setChatType('direct');
    }
  }, [connections, selectedUserId, selectedChat]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Message sending
  const sendMessage = () => {
    actions.sendMessage(input, () => setInput(""));
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
  };

  // Filtered connections
  const filteredConnections = useMemo(() =>
    connections.filter(conn =>
      conn.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conn.realName?.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [connections, searchTerm]
  );

  // Utility functions
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return date.toLocaleDateString();
  };

  const getUserStatus = (userId) => onlineUsers.has(userId) ? 'online' : 'offline';

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'busy': return 'bg-red-500';
      default: return 'bg-zinc-500';
    }
  };

  const getRankIcon = (aegisRating) => {
    if (aegisRating >= 2000) return <Crown className="w-4 h-4 text-amber-400" />;
    if (aegisRating >= 1500) return <Shield className="w-4 h-4 text-purple-400" />;
    if (aegisRating >= 1000) return <Gamepad2 className="w-4 h-4 text-blue-400" />;
    return null;
  };

  // Action handlers with refetch
  const handleStartTryoutWithRefresh = (applicationId) => {
    actions.handleStartTryout(applicationId, {
      onSuccess: (data) => {
        refetchApplications();
        refetchTryouts();
        setSelectedChat(data.tryoutChat);
        setChatType('tryout');
        setShowApplications(false);
      }
    });
  };

  const handleRejectApplicationWithRefresh = (applicationId) => {
    actions.handleRejectApplication(applicationId, {
      onSuccess: () => refetchApplications()
    });
  };

  const handleAcceptApproachWithRefresh = (approachId) => {
    actions.handleAcceptApproach(approachId, {
      onSuccess: (data) => {
        refetchApproaches();
        refetchTryouts();
        setSelectedChat(data.tryoutChat);
        setChatType('tryout');
      }
    });
  };

  const handleRejectApproachWithRefresh = (approachId) => {
    actions.handleRejectApproach(approachId, {
      onSuccess: () => refetchApproaches()
    });
  };

  // Applications Panel Component
  const ApplicationsPanel = () => (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end justify-center z-50 p-4 md:items-center">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-orange-400" />
            Team Applications ({teamApplications.length})
          </h2>
          <button onClick={() => setShowApplications(false)} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {teamApplications.length === 0 ? (
            <div className="text-center py-12 text-zinc-400">
              <UserPlus className="w-12 h-12 mx-auto mb-3 text-zinc-600" />
              <p>No pending applications</p>
            </div>
          ) : (
            teamApplications.map(app => (
              <div key={app._id} className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
                <div className="flex items-start gap-4">
                  <img
                    src={app.player.profilePicture || `https://api.dicebear.com/7.x/avatars/svg?seed=${app.player.username || 'unknown'}`}
                    alt={app.player.username || 'Unknown'}
                    className="w-16 h-16 rounded-xl object-cover"
                  />

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-white">{app.player.inGameName || app.player.username}</h3>
                      {getRankIcon(app.player.aegisRating)}
                      <span className="text-sm text-zinc-400">@{app.player.username}</span>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-zinc-400 mb-2">
                      <span>{app.player.primaryGame}</span>
                      <span>•</span>
                      <span>Rating: {app.player.aegisRating}</span>
                      <span>•</span>
                      <span>Applied {formatTime(app.createdAt)}</span>
                    </div>

                    <div className="mb-3">
                      <p className="text-sm text-zinc-400 mb-1">Applying for:</p>
                      <div className="flex flex-wrap gap-2">
                        {app.appliedRoles.map(role => (
                          <span key={role} className="px-2 py-1 bg-orange-500/20 border border-orange-400/30 rounded-md text-orange-400 text-xs">
                            {role}
                          </span>
                        ))}
                      </div>
                    </div>

                    {app.message && (
                      <div className="bg-zinc-900/50 border border-zinc-700 rounded-lg p-3 mb-3">
                        <p className="text-sm text-zinc-300">{app.message}</p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      {app.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleStartTryoutWithRefresh(app._id)}
                            className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-lg font-medium transition-all text-sm"
                          >
                            Start Tryout
                          </button>
                          <button
                            onClick={() => handleRejectApplicationWithRefresh(app._id)}
                            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors text-sm"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {app.status === 'in_tryout' && (
                        <span className="px-4 py-2 bg-blue-500/20 border border-blue-400/30 text-blue-400 rounded-lg text-sm font-medium">
                          Tryout in Progress
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gradient-to-br from-zinc-950 via-stone-950 to-neutral-950 text-white font-sans">
      {/* Left Sidebar */}
      <div className="w-80 bg-zinc-900/50 border-r border-zinc-800 backdrop-blur-sm flex flex-col">
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Hash className="w-5 h-5 text-orange-400" />
              Chats
            </h2>
            <div className="flex items-center gap-2">
              {user?.team && (
                <button
                  onClick={() => setShowApplications(true)}
                  className="relative p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <Bell className="w-4 h-4 text-zinc-400" />
                  {teamApplications.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-xs flex items-center justify-center">
                      {teamApplications.length}
                    </span>
                  )}
                </button>
              )}
              <button className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
                <Settings className="w-4 h-4 text-zinc-400" />
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-zinc-400 focus:outline-none focus:border-orange-500/50 focus:bg-zinc-800/70 transition-all"
            />
          </div>
        </div>

        {/* Tryout Chats Section */}
        {tryoutChats.length > 0 && (
          <div className="border-b border-zinc-800">
            <div className="p-3 bg-zinc-800/30">
              <h3 className="text-sm font-semibold text-orange-400 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Active Tryouts
              </h3>
            </div>
            <div className="p-2">
              {tryoutChats.map(chat => (
                <div
                  key={chat._id}
                  onClick={() => {
                    setSelectedChat(chat);
                    setChatType('tryout');
                    // No need to manually fetch - React Query will handle it
                  }}
                  className={`p-3 rounded-xl cursor-pointer transition-all mb-2 ${selectedChat?._id === chat._id && chatType === 'tryout'
                    ? "bg-gradient-to-r from-orange-500/20 to-red-600/20 border border-orange-500/30"
                    : "hover:bg-zinc-800/30"
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img
                        src={chat.team.logo}
                        alt={chat.team.teamName}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-orange-500 rounded-full border-2 border-zinc-900" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white truncate text-sm">
                        {chat.team.teamName} Tryout
                      </div>
                      <div className="text-xs text-zinc-400 truncate">
                        Tryout: {chat.applicant.username}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Direct Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-2">
            <div className="px-3 py-2">
              <h3 className="text-sm font-semibold text-zinc-400">Direct Messages</h3>
            </div>
            {filteredConnections.map((conn) => (
              <div
                key={conn._id}
                onClick={() => {
                  setSelectedChat(conn);
                  setChatType('direct');
                }}
                className={`p-3 rounded-xl cursor-pointer transition-all duration-200 mb-2 group hover:bg-zinc-800/50 ${selectedChat?._id === conn._id && chatType === 'direct'
                  ? "bg-gradient-to-r from-orange-500/20 to-red-600/20 border border-orange-500/30"
                  : "hover:bg-zinc-800/30"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={conn.profilePicture || `https://api.dicebear.com/7.x/avatars/svg?seed=${conn.username}`}
                      alt={conn.username}
                      className="w-12 h-12 rounded-xl object-cover border-2 border-zinc-700 group-hover:border-orange-400/50 transition-colors"
                    />
                    {conn._id !== 'system' && (
                      <div className={`absolute -bottom-1 -right-1 w-4 h-4 ${getStatusColor(getUserStatus(conn._id))} rounded-full border-2 border-zinc-900`} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white truncate">
                        {conn.realName || conn.username}
                      </span>
                      {conn._id !== 'system' && getRankIcon(conn.aegisRating)}
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-zinc-400">@{conn.username}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-zinc-800">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Activity className="w-4 h-4 text-green-400" />
            <span>{onlineUsers.size} online</span>
          </div>
        </div>
      </div>

      {/* Chat Window */}
      <div className="flex-1 flex flex-col bg-zinc-900/30">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="bg-zinc-900/50 border-b border-zinc-800 backdrop-blur-sm p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={
                        chatType === 'tryout'
                          ? selectedChat.team?.logo
                          : (selectedChat.profilePicture || `https://api.dicebear.com/7.x/avatars/svg?seed=${selectedChat.username}`)
                      }
                      alt={chatType === 'tryout' ? selectedChat.team?.teamName : selectedChat.username}
                      className="w-10 h-10 rounded-lg object-cover border border-zinc-700"
                    />
                    {chatType === 'direct' && (
                      <div className={`absolute -bottom-1 -right-1 w-3 h-3 ${getStatusColor(getUserStatus(selectedChat._id))} rounded-full border border-zinc-900`} />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">
                        {chatType === 'tryout'
                          ? `${selectedChat.team?.teamName} Tryout`
                          : (selectedChat.realName || selectedChat.username)
                        }
                      </span>
                      {chatType === 'tryout' && selectedChat.tryoutStatus === 'active' && (
                        <span className="px-2 py-0.5 bg-orange-500/20 border border-orange-400/30 text-orange-400 rounded-md text-xs font-medium">
                          Tryout Active
                        </span>
                      )}
                      {chatType === 'tryout' && selectedChat.tryoutStatus === 'offer_sent' && (
                        <span className="px-2 py-0.5 bg-blue-500/20 border border-blue-400/30 text-blue-400 rounded-md text-xs font-medium">
                          Offer Pending
                        </span>
                      )}
                      {chatType === 'tryout' && ['ended_by_team', 'ended_by_player'].includes(selectedChat.tryoutStatus) && (
                        <span className="px-2 py-0.5 bg-red-500/20 border border-red-400/30 text-red-400 rounded-md text-xs font-medium">
                          Tryout Ended
                        </span>
                      )}
                      {chatType === 'tryout' && selectedChat.tryoutStatus === 'offer_accepted' && (
                        <span className="px-2 py-0.5 bg-green-500/20 border border-green-400/30 text-green-400 rounded-md text-xs font-medium">
                          Player Joined
                        </span>
                      )}
                      {chatType === 'tryout' && selectedChat.tryoutStatus === 'offer_rejected' && (
                        <span className="px-2 py-0.5 bg-gray-500/20 border border-gray-400/30 text-gray-400 rounded-md text-xs font-medium">
                          Offer Declined
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-zinc-400">
                      {chatType === 'tryout'
                        ? `Applicant: ${selectedChat.applicant?.username}`
                        : `@${selectedChat.username}`
                      }
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {chatType === 'tryout' && selectedChat.tryoutStatus === 'active' && user?.team?.captain?._id === userId && (
                    <>
                      <button
                        onClick={() => actions.setShowOfferModal(true)}
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-all text-sm flex items-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Send Team Offer
                      </button>
                      <button
                        onClick={() => actions.setShowEndTryoutModal(true)}
                        className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-all text-sm flex items-center gap-2"
                      >
                        <Ban className="w-4 h-4" />
                        End Tryout
                      </button>
                    </>
                  )}
                  {chatType === 'tryout' && selectedChat.tryoutStatus === 'offer_sent' && selectedChat.applicant?._id === userId && (
                    <>
                      <button
                        onClick={() => actions.handleAcceptOffer(navigate)}
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-all text-sm flex items-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Accept Offer
                      </button>
                      <button
                        onClick={actions.handleRejectOffer}
                        className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-all text-sm flex items-center gap-2"
                      >
                        <XCircle className="w-4 h-4" />
                        Decline Offer
                      </button>
                    </>
                  )}

                  <button className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
                    <MoreVertical className="w-4 h-4 text-zinc-400" />
                  </button>
                </div>
              </div>
            </div>

            {/* Chat Messages */}
            <div
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col w-full"
            >
              {messages.map((msg, index) => {
                const isMine = chatType === 'direct'
                  ? msg.senderId === userId
                  : msg.sender?._id === userId || msg.sender === userId;

                // System messages - recruitment approach
                if (msg.messageType === 'system' && msg.metadata?.type === 'recruitment_approach') {
                  return (
                    <div key={msg._id || index} className={`flex w-full ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-md w-full bg-gradient-to-br from-purple-900/50 to-indigo-900/50 border border-purple-500/30 rounded-2xl p-4 shadow-lg">
                        <div className="flex items-center gap-3 mb-3">
                          {msg.metadata?.teamLogo ? (
                            <img
                              src={msg.metadata.teamLogo}
                              alt={msg.metadata.teamName}
                              className="w-12 h-12 rounded-lg object-cover border-2 border-purple-400/50"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-purple-700 rounded-lg flex items-center justify-center text-white font-bold text-lg border-2 border-purple-400/50">
                              {msg.metadata?.teamName?.charAt(0) || 'T'}
                            </div>
                          )}
                          <div className="flex-1">
                            <h4 className="text-white font-bold text-lg">{msg.metadata?.teamName}</h4>
                            <p className="text-purple-200 text-sm">Recruitment Approach</p>
                          </div>
                        </div>

                        <p className="text-purple-100 mb-4">{msg.metadata?.message}</p>

                        {(!msg.metadata?.approachStatus || msg.metadata.approachStatus === 'pending') && (
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleAcceptApproachWithRefresh(msg.metadata?.approachId)}
                              className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
                            >
                              <Check className="w-4 h-4" />
                              Accept & Start Chat
                            </button>
                            <button
                              onClick={() => handleRejectApproachWithRefresh(msg.metadata?.approachId)}
                              className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
                            >
                              <X className="w-4 h-4" />
                              Decline
                            </button>
                          </div>
                        )}

                        {msg.metadata?.approachStatus === 'accepted' && (
                          <div className="bg-green-500/20 border border-green-400/30 rounded-lg px-4 py-2 text-green-300 font-medium text-center">
                            ✓ Approach Accepted - Tryout Chat Created
                          </div>
                        )}

                        {msg.metadata?.approachStatus === 'rejected' && (
                          <div className="bg-red-500/20 border border-red-400/30 rounded-lg px-4 py-2 text-red-300 font-medium text-center">
                            ✗ Approach Declined
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                // Team invitation messages
                if (msg.messageType === 'invitation') {
                  return (
                    <div key={msg._id || index} className={`flex w-full ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-md w-full bg-gradient-to-br from-blue-900/50 to-indigo-900/50 border border-blue-500/30 rounded-2xl p-4 shadow-lg">
                        <div className="flex items-center gap-3 mb-3">
                          {msg.team?.logo ? (
                            <img
                              src={msg.team.logo}
                              alt={msg.team.teamName}
                              className="w-12 h-12 rounded-lg object-cover border-2 border-blue-400/50"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-blue-700 rounded-lg flex items-center justify-center text-white font-bold text-lg border-2 border-blue-400/50">
                              {msg.team?.teamName?.charAt(0) || 'T'}
                            </div>
                          )}
                          <div className="flex-1">
                            <h4 className="text-white font-bold text-lg">{msg.team?.teamName}</h4>
                            <p className="text-blue-200 text-sm">Team Invitation</p>
                          </div>
                        </div>

                        <p className="text-blue-100 mb-4">{msg.message}</p>

                        {msg.invitationStatus !== 'accepted' && msg.invitationStatus !== 'declined' && (
                          <div className="flex gap-3">
                            <button
                              onClick={() => actions.handleAcceptInvitation(msg.invitationId._id)}
                              className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
                            >
                              <Check className="w-4 h-4" />
                              Accept Invitation
                            </button>
                            <button
                              onClick={() => actions.handleDeclineInvitation(msg.invitationId._id)}
                              className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
                            >
                              <X className="w-4 h-4" />
                              Decline
                            </button>
                          </div>
                        )}

                        {msg.invitationStatus === 'accepted' && (
                          <div className="bg-green-500/20 border border-green-400/30 rounded-lg px-4 py-2 text-green-300 font-medium text-center">
                            ✓ Invitation Accepted - You joined the team!
                          </div>
                        )}

                        {msg.invitationStatus === 'declined' && (
                          <div className="bg-red-500/20 border border-red-400/30 rounded-lg px-4 py-2 text-red-300 font-medium text-center">
                            ✗ Invitation Declined
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <ChatMessage
                    key={msg._id || index}
                    msg={msg}
                    userId={userId}
                    chatType={chatType}
                    selectedChat={selectedChat}
                    index={index}
                    messages={messages}
                  />
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <div className="p-4 border-t border-zinc-800">
              {chatType === 'tryout' && ['ended_by_team', 'ended_by_player', 'offer_sent', 'offer_accepted', 'offer_rejected'].includes(selectedChat.tryoutStatus) ? (
                <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 text-center">
                  <AlertCircle className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
                  <p className="text-zinc-400 text-sm">
                    This tryout has ended. No new messages can be sent.
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="Type your message..."
                    value={input}
                    onChange={handleInputChange}
                    onKeyPress={handleKeyPress}
                    className="flex-1 bg-zinc-800/50 border border-zinc-700 rounded-lg pl-4 pr-10 py-2 text-white placeholder-zinc-400 focus:outline-none focus:border-orange-500/50 focus:bg-zinc-800/70 transition-all"
                  />
                  <button
                    onClick={sendMessage}
                    className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-lg font-medium transition-all"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-zinc-500">Select a chat to start messaging</p>
          </div>
        )}
      </div>

      {/* End Tryout Modal */}
      {actions.showEndTryoutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl max-w-md w-full p-6 border border-zinc-700">
            <h3 className="text-lg font-semibold text-white mb-4">End Tryout</h3>
            <p className="text-zinc-400 mb-4 text-sm">
              Are you sure you want to end this tryout? No further messages can be sent after ending.
            </p>
            <textarea
              value={actions.endReason}
              onChange={(e) => actions.setEndReason(e.target.value)}
              placeholder="Reason for ending (required)"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 mb-4"
              rows="3"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  actions.setShowEndTryoutModal(false);
                  actions.setEndReason('');
                }}
                className="flex-1 px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={actions.handleEndTryout}
                disabled={!actions.endReason.trim()}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                End Tryout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Offer Modal */}
      {actions.showOfferModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl max-w-md w-full p-6 border border-zinc-700">
            <h3 className="text-lg font-semibold text-white mb-4">Send Team Join Offer</h3>
            <p className="text-zinc-400 mb-4 text-sm">
              Invite {selectedChat?.applicant?.username} to join your team.
            </p>
            <textarea
              value={actions.offerMessage}
              onChange={(e) => actions.setOfferMessage(e.target.value)}
              placeholder="Custom message (optional)"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 mb-4"
              rows="3"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  actions.setShowOfferModal(false);
                  actions.setOfferMessage('');
                }}
                className="flex-1 px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={actions.handleSendOffer}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                Send Offer
              </button>
            </div>
          </div>
        </div>
      )}

      {showApplications && <ApplicationsPanel />}
    </div>
  );
}


