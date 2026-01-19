import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

const SocketContext = createContext(null);

export const useSocket = () => {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error('useSocket must be used within SocketProvider');
    }
    return context;
};

export const SocketProvider = ({ children, userId }) => {
    const socketRef = useRef(null);
    const [isConnected, setIsConnected] = useState(false);
    const currentRoomsRef = useRef(new Set());
    const listenersRef = useRef(new Map());

    // Initialize socket once when provider mounts
    useEffect(() => {
        if (!userId) return;

        console.log('🔌 Initializing persistent socket connection for user:', userId);

        // Create single socket instance
        socketRef.current = io(API_URL, {
            withCredentials: true,
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5
        });

        // Connection event handlers
        socketRef.current.on('connect', () => {
            console.log('✅ Socket connected:', socketRef.current.id);
            setIsConnected(true);

            // Join user's personal room
            socketRef.current.emit('joinRoom', userId);

            // Rejoin any active rooms after reconnection
            currentRoomsRef.current.forEach(room => {
                console.log('🔄 Rejoining room after reconnect:', room);
                if (room.startsWith('tryout_')) {
                    socketRef.current.emit('joinTryoutChat', room.replace('tryout_', ''));
                }
            });
        });

        socketRef.current.on('disconnect', (reason) => {
            console.log('❌ Socket disconnected:', reason);
            setIsConnected(false);
        });

        socketRef.current.on('connect_error', (error) => {
            console.error('❌ Socket connection error:', error);
        });

        socketRef.current.on('error', (error) => {
            console.error('❌ Socket error:', error);
        });

        // Cleanup on unmount
        return () => {
            console.log('🔌 Cleaning up socket connection');
            if (socketRef.current) {
                // Leave all rooms
                currentRoomsRef.current.forEach(room => {
                    if (room.startsWith('tryout_')) {
                        socketRef.current.emit('leaveTryoutChat', room.replace('tryout_', ''));
                    }
                });
                currentRoomsRef.current.clear();

                // Remove all listeners
                socketRef.current.removeAllListeners();

                // Disconnect
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [userId]);

    // Join a chat room
    const joinRoom = (roomId, roomType = 'direct') => {
        if (!socketRef.current || !socketRef.current.connected) {
            console.warn('⚠️ Socket not connected, cannot join room:', roomId);
            return;
        }

        const roomKey = roomType === 'tryout' ? `tryout_${roomId}` : roomId;

        if (currentRoomsRef.current.has(roomKey)) {
            console.log('ℹ️ Already in room:', roomKey);
            return;
        }

        console.log(`📥 Joining ${roomType} room:`, roomId);

        if (roomType === 'tryout') {
            socketRef.current.emit('joinTryoutChat', roomId);
        }

        currentRoomsRef.current.add(roomKey);
    };

    // Leave a chat room
    const leaveRoom = (roomId, roomType = 'direct') => {
        if (!socketRef.current || !socketRef.current.connected) {
            return;
        }

        const roomKey = roomType === 'tryout' ? `tryout_${roomId}` : roomId;

        if (!currentRoomsRef.current.has(roomKey)) {
            return;
        }

        console.log(`📤 Leaving ${roomType} room:`, roomId);

        if (roomType === 'tryout') {
            socketRef.current.emit('leaveTryoutChat', roomId);
        }

        currentRoomsRef.current.delete(roomKey);
    };

    // Register an event listener
    const on = (event, callback) => {
        if (!socketRef.current) {
            console.warn('⚠️ Socket not initialized, cannot register listener:', event);
            return () => { };
        }

        // Store callback reference
        const listenerId = `${event}_${Date.now()}_${Math.random()}`;
        listenersRef.current.set(listenerId, { event, callback });

        socketRef.current.on(event, callback);

        // Return cleanup function
        return () => {
            if (socketRef.current) {
                socketRef.current.off(event, callback);
            }
            listenersRef.current.delete(listenerId);
        };
    };

    // Remove an event listener
    const off = (event, callback) => {
        if (socketRef.current) {
            socketRef.current.off(event, callback);
        }
    };

    // Emit an event
    const emit = (event, data) => {
        if (!socketRef.current || !socketRef.current.connected) {
            console.warn('⚠️ Socket not connected, cannot emit:', event);
            return false;
        }

        socketRef.current.emit(event, data);
        return true;
    };

    // Send a message (convenience method)
    const sendMessage = (messageType, data) => {
        const eventName = messageType === 'tryout' ? 'sendTryoutMessage' : 'sendMessage';
        return emit(eventName, data);
    };

    const contextValue = {
        socket: socketRef.current,
        isConnected,
        joinRoom,
        leaveRoom,
        on,
        off,
        emit,
        sendMessage,
        getCurrentRooms: () => Array.from(currentRoomsRef.current)
    };

    return (
        <SocketContext.Provider value={contextValue}>
            {children}
        </SocketContext.Provider>
    );
};
