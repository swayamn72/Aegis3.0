import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Trophy, Sparkles } from 'lucide-react';
import botLogo from '../assets/bot_logo.png';
import ChatAvatar from './ChatAvatar';

const ChatMessage = ({ msg, userId, chatType, selectedChat, index, messages }) => {
    const navigate = useNavigate();
    // Helper function to format timestamp
    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return 'now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
        return date.toLocaleDateString();
    };

    // Normal messages - WhatsApp style
    const isMine = chatType === 'direct'
        ? msg.senderId === userId
        : msg.sender?._id === userId || msg.sender === userId;

    // Get sender info for group chats
    const getSenderInfo = () => {
        if (chatType !== 'tryout' || isMine) return null;

        const senderId = msg.sender?._id || msg.sender;

        // Handle system messages with bot logo
        if (senderId === 'system' || msg.messageType === 'system') {
            return { username: 'Aegis Bot', profilePicture: botLogo };
        }

        const senderData = selectedChat?.participants?.find(p =>
            (p._id || p).toString() === senderId?.toString()
        );

        return senderData || { username: 'Unknown', profilePicture: null };
    };

    const senderInfo = getSenderInfo();

    // Show sender name only if it's a group chat, not mine, and different from previous
    const showSenderName = chatType === 'tryout' && !isMine && (
        index === 0 || messages[index - 1]?.sender !== msg.sender
    );

    // Helper function to parse markdown links
    const parseMarkdownLinks = (text) => {
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        const parts = [];
        let lastIndex = 0;
        let match;

        while ((match = linkRegex.exec(text)) !== null) {
            // Add text before the link
            if (match.index > lastIndex) {
                parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
            }
            // Add the link
            parts.push({ type: 'link', text: match[1], url: match[2] });
            lastIndex = match.index + match[0].length;
        }

        // Add remaining text
        if (lastIndex < text.length) {
            parts.push({ type: 'text', content: text.slice(lastIndex) });
        }

        return parts.length > 0 ? parts : [{ type: 'text', content: text }];
    };

    // Handle button click for tournament references
    const handleButtonClick = (url) => {
        if (url.startsWith('http')) {
            // If it's a full URL, extract the path
            const urlObj = new URL(url);
            navigate(urlObj.pathname);
        } else {
            // If it's a relative path
            navigate(url);
        }
    };

    // Check if this is a tournament reference message
    const isTournamentReference = msg.messageType === 'tournament_reference';

    return (
        <div className={`flex w-full ${isMine ? 'justify-end' : 'justify-start'} items-end gap-2`}>
            {/* Sender Avatar (Group Chats Only, Left Side) */}
            {chatType === 'tryout' && !isMine && (
                <div className="flex-shrink-0 mb-1">
                    {showSenderName ? (
                        <ChatAvatar
                            src={senderInfo?.profilePicture}
                            fallbackSeed={senderInfo?.username || 'unknown'}
                            alt={senderInfo?.username || 'Unknown'}
                            className="w-8 h-8 rounded-full ring-2 ring-zinc-700"
                        />
                    ) : (
                        <div className="w-8 h-8" />
                    )}
                </div>
            )}

            {/* Message Bubble */}
            <div className={`${isTournamentReference ? 'max-w-[85%] lg:max-w-[75%]' : 'max-w-[70%] lg:max-w-[60%]'}`}>
                {/* Sender Name (Group Chats Only) */}
                {showSenderName && (
                    <div className="text-xs text-zinc-400 mb-1 ml-3">
                        {senderInfo?.username || 'Unknown'}
                    </div>
                )}

                {/* Message Content */}
                <div className={`relative px-4 py-2.5 rounded-2xl shadow-lg break-words ${isMine
                    ? 'bg-gradient-to-br from-orange-500 to-red-600 text-white rounded-br-sm'
                    : isTournamentReference
                        ? 'bg-gradient-to-br from-indigo-950 via-purple-950 to-blue-950 text-white border-2 border-purple-500/40 rounded-bl-sm backdrop-blur-sm'
                        : 'bg-zinc-800/90 text-white border border-zinc-700/50 rounded-bl-sm'
                    }`}>
                    {/* Tournament Logo & Header */}
                    {isTournamentReference && msg.metadata?.logo && (
                        <div className="mb-3 pb-3 border-b border-purple-400/30 flex items-center gap-3">
                            <div className="relative">
                                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg blur opacity-50"></div>
                                <img
                                    src={msg.metadata.logo}
                                    alt="Tournament Logo"
                                    className="relative w-16 h-16 object-cover rounded-lg ring-2 ring-purple-400/50 shadow-lg"
                                />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <Trophy className="w-4 h-4 text-yellow-400" />
                                    <span className="text-xs font-semibold text-purple-300 uppercase tracking-wide">Tournament Invitation</span>
                                </div>
                                {msg.metadata?.tier && (
                                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${msg.metadata.tier === 'S' ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white' :
                                        msg.metadata.tier === 'A' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' :
                                            msg.metadata.tier === 'B' ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white' :
                                                'bg-gradient-to-r from-gray-500 to-gray-600 text-white'
                                        }`}>
                                        TIER {msg.metadata.tier}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Message Text */}
                    {isTournamentReference ? (
                        <div className="space-y-1 text-[15px] leading-relaxed">
                            {/* Remove markdown links from display, just show plain text */}
                            {msg.message.split('\n').map((line, idx) => {
                                // Skip lines that are markdown links (they'll be shown as button instead)
                                if (line.match(/\[.*\]\(.*\)/)) return null;
                                // Skip empty lines at the end
                                if (!line.trim()) return <div key={idx} className="h-1"></div>;
                                return <div key={idx}>{line}</div>;
                            })}
                        </div>
                    ) : (
                        <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                            {msg.message}
                        </p>
                    )}

                    {/* Tournament Button */}
                    {isTournamentReference && (
                        <div className="mt-3">
                            <button
                                onClick={() => {
                                    // Extract tournament ID from button URL or message text
                                    let tournamentId = msg.tournamentId;

                                    // Try button URL first
                                    if (msg.button?.url) {
                                        const urlMatch = msg.button.url.match(/\/tournament\/([a-f0-9]+)/i);
                                        if (urlMatch) {
                                            tournamentId = urlMatch[1];
                                        }
                                    }

                                    // If still not found, extract from message text
                                    if (!tournamentId && msg.message) {
                                        const urlMatch = msg.message.match(/\/tournament\/([a-f0-9]+)/i);
                                        if (urlMatch) {
                                            tournamentId = urlMatch[1];
                                        }
                                    }

                                    console.log('Message data:', msg);
                                    console.log('Extracted Tournament ID:', tournamentId);

                                    if (tournamentId && tournamentId !== 'undefined') {
                                        navigate(`/tournament/${tournamentId}`);
                                    } else {
                                        console.error('No valid tournament ID found');
                                    }
                                }}
                                className="group relative w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <Trophy className="w-4 h-4" />
                                <span className="text-sm">{msg.button?.text || 'View Tournament Details'}</span>
                                <ExternalLink className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {/* Timestamp */}
                    <div className={`text-[11px] mt-1 flex items-center gap-1 ${isMine
                        ? 'text-orange-100/70 justify-end'
                        : isTournamentReference
                            ? 'text-purple-300/70'
                            : 'text-zinc-500'
                        }`}>
                        <span>{formatTime(msg.timestamp)}</span>

                        {/* Read Receipt (for sent messages) */}
                        {isMine && (
                            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z" />
                            </svg>
                        )}
                    </div>
                </div>

                {/* Message Tail */}
                <svg
                    className={`absolute bottom-0 ${isMine
                        ? '-right-2 text-red-600'
                        : isTournamentReference
                            ? '-left-2 text-indigo-950'
                            : '-left-2 text-zinc-800'
                        }`}
                    width="12"
                    height="19"
                    viewBox="0 0 12 19"
                >
                    <path
                        fill="currentColor"
                        d={isMine
                            ? "M0,0 L12,0 L12,19 C12,19 6,15 0,19 Z"
                            : "M12,0 L0,0 L0,19 C0,19 6,15 12,19 Z"
                        }
                    />
                </svg>
            </div>
        </div>
    );
};

export default ChatMessage;
