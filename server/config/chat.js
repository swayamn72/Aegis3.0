// Firebase Admin SDK singleton initialized in firebase.js
import admin from './firebase.js';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import Player from '../models/player.model.js';
import TryoutChat from '../models/tryoutChat.model.js';
import { createTryoutMessage } from '../services/tryoutMessage.service.js';
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

        // Push Notification (FCM) for all mobile recipients except sender
        const PlayerModel = (await import('../models/player.model.js')).default;
        const recipientIds = chat.participants.filter(p => p.toString() !== authenticatedSenderId);
        if (recipientIds.length > 0) {
          const recipients = await PlayerModel.find({ _id: { $in: recipientIds } }).select('fcmToken username');
          const tokens = recipients.map(r => r.fcmToken).filter(Boolean);
          if (tokens.length > 0) {
            const sender = await PlayerModel.findById(authenticatedSenderId).select('username');
            const senderName = sender ? sender.username : 'Someone';
            try {
              const response = await admin.messaging().sendEachForMulticast({
                notification: {
                  title: 'New Chat Message',
                  body: `${senderName}: ${trimmedMessage}`
                },
                data: {
                  type: 'chat_message',
                  chatId: chatId.toString(),
                  senderId: authenticatedSenderId.toString(),
                  senderName: senderName,
                  message: trimmedMessage,
                  timestamp: new Date().toISOString()
                },
                android: {
                  priority: 'high',
                  notification: {
                    channelId: 'high_importance_channel',
                    priority: 'high',
                    sound: 'default',
                    defaultVibrateTimings: true
                  }
                },
                apns: {
                  payload: {
                    aps: {
                      contentAvailable: true,
                      sound: 'default'
                    }
                  },
                  headers: {
                    'apns-priority': '10'
                  }
                },
                tokens
              });

              // Clean up invalid tokens
              if (response.failureCount > 0) {
                response.responses.forEach((resp, idx) => {
                  if (!resp.success &&
                    (resp.error?.code === 'messaging/invalid-registration-token' ||
                      resp.error?.code === 'messaging/registration-token-not-registered')) {
                    // Remove invalid token from database
                    PlayerModel.updateOne(
                      { fcmToken: tokens[idx] },
                      { $unset: { fcmToken: '' } }
                    ).catch(() => { });
                  }
                });
              }

            } catch (err) {
              logger.error('chat_fcm_send_error', {
                chatId,
                userId: authenticatedSenderId,
                error: err.message,
              });
            }
          }
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
