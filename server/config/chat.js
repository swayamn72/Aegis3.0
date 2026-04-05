// Firebase Admin SDK singleton initialized in firebase.js
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import Player from '../models/player.model.js';
import TryoutChat from '../models/tryoutChat.model.js';
import ChatMessage from '../models/chat.model.js';
import { createTryoutMessage } from '../services/tryoutMessage.service.js';
import notificationService from '../services/notification.service.js';
import { allowedOrigins } from './cors.js';
import logger from './logger.js';

const SOCKET_REDIS_CONNECT_TIMEOUT_MS = parseInt(process.env.SOCKET_REDIS_CONNECT_TIMEOUT_MS || '5000', 10);

const withTimeout = async (promise, timeoutMs, label) => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
};

const shouldEnableRedisAdapter = () => {
  if ((process.env.SOCKET_ADAPTER || '').toLowerCase() === 'redis') return true;
  if (process.env.REDIS_URL) return true;
  return false;
};

const buildRedisConfig = () => {
  if (process.env.REDIS_URL) {
    return {
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 2000),
      },
    };
  }

  const host = process.env.REDIS_HOST || '127.0.0.1';
  const port = parseInt(process.env.REDIS_PORT || '6379', 10);
  const password = process.env.REDIS_PASSWORD;

  return {
    socket: {
      host,
      port,
      reconnectStrategy: (retries) => Math.min(retries * 50, 2000),
    },
    ...(password ? { password } : {}),
  };
};

const isSocketTokenExpired = (socket) => {
  const exp = socket.tokenExp;
  if (!exp) return true;
  // JWT exp is in seconds since epoch.
  return Date.now() >= exp * 1000;
};

const rejectExpiredSocket = (socket) => {
  logger.warn('socket_token_expired', {
    socketId: socket.id,
    userId: socket.userId,
  });
  socket.emit('tokenExpired', { message: 'Session expired. Please login again.' });
  socket.disconnect(true);
};

const initChat = async (server) => {
  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
      methods: ["GET", "POST"]
    },
    // Performance: enable per-message compression for 10k+ connections
    perMessageDeflate: {
      threshold: 1024, // only compress messages > 1KB
    },
  });

  if (shouldEnableRedisAdapter()) {
    const redisConfig = buildRedisConfig();
    const redisPubClient = createClient(redisConfig);
    const redisSubClient = redisPubClient.duplicate();

    const onRedisError = (clientName) => (err) => {
      logger.error('socket_redis_client_error', {
        client: clientName,
        error: err.message,
      });
    };

    redisPubClient.on('error', onRedisError('pub'));
    redisSubClient.on('error', onRedisError('sub'));

    try {
      await Promise.all([
        withTimeout(redisPubClient.connect(), SOCKET_REDIS_CONNECT_TIMEOUT_MS, 'Redis pub connect'),
        withTimeout(redisSubClient.connect(), SOCKET_REDIS_CONNECT_TIMEOUT_MS, 'Redis sub connect'),
      ]);

      io.adapter(createAdapter(redisPubClient, redisSubClient));
      io.redisClients = { redisPubClient, redisSubClient };

      logger.info('socket_redis_adapter_enabled', {
        mode: process.env.REDIS_URL ? 'url' : 'host_port',
      });
    } catch (err) {
      logger.error('socket_redis_adapter_init_failed', {
        error: err.message,
      });

      // Keep service available on single-node mode if Redis is unavailable.
      await Promise.allSettled([
        redisPubClient.quit(),
        redisSubClient.quit(),
      ]);
    }
  } else {
    logger.info('socket_inmemory_adapter_enabled');
  }

  // =========================================================================
  // Socket.IO Authentication Middleware
  // Verify JWT before allowing any socket connection
  // =========================================================================
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        logger.warn('socket_auth_missing_token', { socketId: socket.id });
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      socket.tokenExp = decoded.exp;
      next();
    } catch (err) {
      logger.warn('socket_auth_invalid_token', {
        socketId: socket.id,
        error: err.message,
      });
      return next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info('socket_connected', { socketId: socket.id, userId: socket.userId });

    // Auto-join the authenticated user's personal room
    socket.join(socket.userId);

    // ✅ Join user's personal room (kept for backwards compat, but now verified)
    socket.on('joinRoom', async (userId) => {
      try {
        if (isSocketTokenExpired(socket)) {
          rejectExpiredSocket(socket);
          return;
        }

        // Only allow joining your OWN room
        if (userId !== socket.userId) {
          socket.emit('error', { message: 'Cannot join another user\'s room' });
          return;
        }
        socket.join(userId);
      } catch (error) {
        logger.error('socket_join_room_error', {
          socketId: socket.id,
          userId: socket.userId,
          error: error.message,
        });
      }
    });

    // Join tryout chat room
    socket.on('joinTryoutChat', async (chatId) => {
      try {
        if (isSocketTokenExpired(socket)) {
          rejectExpiredSocket(socket);
          return;
        }

        const roomName = `tryout_${chatId}`;
        socket.join(roomName);

        // Confirm join to client
        socket.emit('tryoutChatJoined', { chatId, roomName });
      } catch (error) {
        logger.error('socket_join_tryout_error', {
          socketId: socket.id,
          userId: socket.userId,
          chatId,
          error: error.message,
        });
        socket.emit('error', { message: 'Failed to join tryout chat' });
      }
    });

    // Leave tryout chat room
    socket.on('leaveTryoutChat', (chatId) => {
      const roomName = `tryout_${chatId}`;
      socket.leave(roomName);
    });

    // Send direct message
    socket.on('sendMessage', async ({ receiverId, message }) => {
      try {
        if (isSocketTokenExpired(socket)) {
          rejectExpiredSocket(socket);
          return;
        }

        const senderId = socket.userId;

        if (!receiverId || !mongoose.Types.ObjectId.isValid(receiverId)) {
          socket.emit('error', { message: 'Invalid receiverId' });
          return;
        }

        if (receiverId.toString() === senderId.toString()) {
          socket.emit('error', { message: 'Cannot send message to yourself' });
          return;
        }

        const trimmedMessage = (message || '').trim();
        if (!trimmedMessage) {
          socket.emit('error', { message: 'Message cannot be empty' });
          return;
        }

        const chatMessage = await ChatMessage.create({
          senderId,
          receiverId: receiverId.toString(),
          message: trimmedMessage,
          messageType: 'text',
          timestamp: new Date(),
        });

        const payload = {
          _id: chatMessage._id,
          senderId,
          receiverId: receiverId.toString(),
          message: trimmedMessage,
          messageType: 'text',
          timestamp: chatMessage.timestamp,
        };

        io.to(receiverId.toString()).emit('receiveMessage', payload);

        const senderSockets = io.sockets.adapter.rooms.get(senderId.toString());
        if (senderSockets && senderSockets.size > 0) {
          socket.to(senderId.toString()).emit('receiveMessage', payload);
        }

        const receiverSockets = io.sockets.adapter.rooms.get(receiverId.toString());
        const receiverIsOnline = receiverSockets && receiverSockets.size > 0;

        if (!receiverIsOnline) {
          const sender = await Player.findById(senderId).select('username').lean();
          const senderName = sender?.username || 'New message';

          notificationService
            .sendToPlayer(
              receiverId.toString(),
              senderName,
              trimmedMessage,
              {
                type: 'chat_message',
                directUserId: senderId.toString(),
                senderId: senderId.toString(),
                senderName,
              }
            )
            .catch((err) => {
              logger.error('chat_direct_push_error', {
                senderId,
                receiverId: receiverId.toString(),
                error: err.message,
              });
            });
        }
      } catch (error) {
        logger.error('socket_send_direct_message_error', {
          socketId: socket.id,
          userId: socket.userId,
          error: error.message,
        });
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Send message in tryout chat
    socket.on('sendTryoutMessage', async ({ chatId, message }) => {
      try {
        if (isSocketTokenExpired(socket)) {
          rejectExpiredSocket(socket);
          return;
        }

        // Use authenticated userId instead of client-sent senderId
        const authenticatedSenderId = socket.userId;

        const chat = await TryoutChat.findById(chatId);

        if (!chat) {
          socket.emit('error', { message: 'Chat not found' });
          return;
        }

        // Verify sender is participant using authenticated ID
        if (!chat.participants.some(p => p.toString() === authenticatedSenderId)) {
          socket.emit('error', { message: 'Not authorized' });
          return;
        }

        const trimmedMessage = (message || '').trim();
        if (!trimmedMessage) {
          socket.emit('error', { message: 'Message cannot be empty' });
          return;
        }

        const createdMessage = await createTryoutMessage({
          chatId,
          sender: authenticatedSenderId,
          message: trimmedMessage,
          messageType: 'text',
          timestamp: new Date(),
        });

        const populatedMessage = {
          _id: createdMessage._id,
          sender: authenticatedSenderId,
          message: createdMessage.message,
          messageType: createdMessage.messageType,
          timestamp: createdMessage.timestamp,
        };

        // Broadcast to all in room
        io.to(`tryout_${chatId}`).emit('newTryoutMessage', {
          chatId,
          message: populatedMessage
        });

        // Push notification for participants not currently online.
        const sender = await Player.findById(authenticatedSenderId).select('username').lean();
        const senderName = sender?.username || 'Someone';
        const recipientIds = chat.participants
          .map((p) => p.toString())
          .filter((id) => id !== authenticatedSenderId.toString())
          .filter((id) => {
            const sockets = io.sockets.adapter.rooms.get(id);
            return !(sockets && sockets.size > 0);
          });

        if (recipientIds.length > 0) {
          notificationService
            .sendToMultiplePlayers(
              recipientIds,
              `${senderName} in tryout chat`,
              trimmedMessage,
              {
                type: 'tryout_chat_message',
                chatId: chatId.toString(),
                senderId: authenticatedSenderId.toString(),
                senderName,
              }
            )
            .catch((err) => {
              logger.error('chat_tryout_push_error', {
                chatId,
                userId: authenticatedSenderId,
                error: err.message,
              });
            });
        }

      } catch (error) {
        logger.error('socket_send_tryout_message_error', {
          socketId: socket.id,
          userId: socket.userId,
          chatId,
          error: error.message,
        });
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('disconnect', () => {
      logger.info('socket_disconnected', {
        socketId: socket.id,
        userId: socket.userId,
      });
    });
  });

  return io;
};

export default initChat;
