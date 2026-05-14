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
import { isEitherUserBlocked } from '../utils/blockUtils.js';
import { ensurePendingMessageRequest, getMessageRequestRelationship } from '../utils/directMessageRequestUtils.js';

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

    // --- Live Match Subscription (public match data) ---
    socket.on('joinMatch', (matchId) => {
      if (matchId && typeof matchId === 'string') {
        socket.join(`match:${matchId}`);
        socket.emit('matchJoined', { matchId });
      }
    });
    socket.on('leaveMatch', (matchId) => {
      if (matchId) socket.leave(`match:${matchId}`);
    });

    // --- Fantasy Contest Subscription ---
    socket.on('joinFantasyContest', (contestId) => {
      if (contestId && typeof contestId === 'string') {
        socket.join(`fantasy:${contestId}`);
        socket.emit('fantasyContestJoined', { contestId });
      }
    });
    socket.on('leaveFantasyContest', (contestId) => {
      if (contestId) socket.leave(`fantasy:${contestId}`);
    });

    // Join tryout chat room (with participant authorization)
    socket.on('joinTryoutChat', async (chatId) => {
      try {
        if (isSocketTokenExpired(socket)) {
          rejectExpiredSocket(socket);
          return;
        }

        // Verify the user is a participant of this chat
        const chat = await TryoutChat.findById(chatId).select('participants').lean();
        if (!chat || !chat.participants.some(p => p.toString() === socket.userId)) {
          socket.emit('error', { message: 'Not authorized for this chat' });
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

        const isBlocked = await isEitherUserBlocked(senderId, receiverId);
        if (isBlocked) {
          socket.emit('error', { message: 'This user is not available for messaging', blocked: true });
          return;
        }

        const relationship = await getMessageRequestRelationship(senderId, receiverId);
        if (!relationship.canMessage) {
          const pending = await ensurePendingMessageRequest({
            requesterId: senderId,
            recipientId: receiverId,
            initialMessage: message,
          });

          socket.emit('error', {
            message: pending.status === 'pending_received'
              ? 'This player already requested to message you. Accept the request first.'
              : 'Message request required before chatting',
            requestRequired: true,
            requestStatus: pending.status,
            requestId: pending.request?._id || relationship.requestId || null,
          });
          return;
        }

        const MAX_MESSAGE_LENGTH = 2000;
        const trimmedMessage = (message || '').trim();
        if (!trimmedMessage) {
          socket.emit('error', { message: 'Message cannot be empty' });
          return;
        }
        if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
          socket.emit('error', { message: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)` });
          return;
        }

        const chatMessage = await ChatMessage.create({
          senderId,
          receiverId: receiverId.toString(),
          message: trimmedMessage,
          messageType: 'text',
          timestamp: new Date(),
        });

        // Look up sender profile so the receiver can display proper username
        // even if the sender is not in their connections list yet.
        const senderProfile = await Player.findById(senderId)
          .select('username profilePicture')
          .lean();

        const payload = {
          _id: chatMessage._id,
          senderId,
          receiverId: receiverId.toString(),
          message: trimmedMessage,
          messageType: 'text',
          timestamp: chatMessage.timestamp,
          senderUsername: senderProfile?.username || null,
          senderProfilePicture: senderProfile?.profilePicture || null,
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

        const otherParticipants = chat.participants
          .map((p) => p.toString())
          .filter((id) => id !== authenticatedSenderId.toString());
        for (const otherId of otherParticipants) {
          // Prevent message flow in either direction if either side blocked the other.
          if (await isEitherUserBlocked(authenticatedSenderId, otherId)) {
            socket.emit('error', { message: 'This user is not available for messaging', blocked: true });
            return;
          }
        }

        const MAX_MESSAGE_LENGTH = 2000;
        const trimmedMessage = (message || '').trim();
        if (!trimmedMessage) {
          socket.emit('error', { message: 'Message cannot be empty' });
          return;
        }
        if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
          socket.emit('error', { message: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)` });
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

    // --- Match Room Chat ---
    socket.on('joinMatchRoom', async (matchId) => {
      try {
        if (isSocketTokenExpired(socket)) {
          rejectExpiredSocket(socket);
          return;
        }
        if (matchId && typeof matchId === 'string') {
          const roomName = `matchRoom:${matchId}`;
          socket.join(roomName);
          socket.emit('matchRoomJoined', { matchId, roomName });
          logger.info('socket_match_room_joined', { socketId: socket.id, userId: socket.userId, matchId });
        }
      } catch (error) {
        logger.error('socket_join_match_room_error', {
          socketId: socket.id,
          userId: socket.userId,
          matchId,
          error: error.message,
        });
      }
    });

    socket.on('leaveMatchRoom', (matchId) => {
      if (matchId) socket.leave(`matchRoom:${matchId}`);
    });

    socket.on('sendMatchRoomMessage', async ({ matchId, message }) => {
      try {
        if (isSocketTokenExpired(socket)) {
          rejectExpiredSocket(socket);
          return;
        }

        const senderId = socket.userId;
        const trimmedMessage = (message || '').trim();
        if (!trimmedMessage || trimmedMessage.length > 500) {
          socket.emit('error', { message: 'Invalid message (empty or > 500 chars)' });
          return;
        }

        // Lazy-import to avoid circular dependency
        const { default: MatchRoomMessage } = await import('../models/matchRoomMessage.model.js');
        const { default: PlayerModel } = await import('../models/player.model.js');

        const msg = await MatchRoomMessage.create({
          match: matchId,
          sender: senderId,
          senderModel: 'Player',
          message: trimmedMessage,
          messageType: 'text',
        });

        const senderProfile = await PlayerModel.findById(senderId)
          .select('username profilePicture inGameName')
          .lean();

        const payload = {
          _id: msg._id,
          match: matchId,
          sender: senderProfile || { _id: senderId, username: 'Unknown' },
          message: trimmedMessage,
          messageType: 'text',
          createdAt: msg.createdAt,
        };

        io.to(`matchRoom:${matchId}`).emit('matchRoom:message', payload);
      } catch (error) {
        logger.error('socket_match_room_send_error', {
          socketId: socket.id,
          userId: socket.userId,
          error: error.message,
        });
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // --- Map Veto WebSocket ---

    // Player joins the veto room — signals their team is present
    socket.on('mapVeto:ready', async ({ matchId }) => {
      try {
        if (isSocketTokenExpired(socket)) { rejectExpiredSocket(socket); return; }

        const { default: mapVetoService } = await import('../services/mapVeto.service.js');
        const { default: RegistrationModel } = await import('../models/registration.model.js');
        const { default: MatchModel } = await import('../models/match.model.js');

        const match = await MatchModel.findById(matchId).select('tournament vsResults gameTitle').lean();
        if (!match) { socket.emit('error', { message: 'Match not found' }); return; }

        // Only Valorant matches use map veto
        if (match.gameTitle !== 'VALORANT') {
          socket.emit('mapVeto:error', { error: 'Map veto is only available for Valorant matches' });
          return;
        }

        const reg = await RegistrationModel.findOne({
          tournament: match.tournament,
          'roster.player': socket.userId,
        }).select('team').lean();

        if (!reg) { socket.emit('error', { message: 'Not authorized for this match' }); return; }

        const teamId = reg.team.toString();

        // Join the match socket room so they receive all veto broadcasts
        socket.join(`match:${matchId}`);

        const result = mapVetoService.teamMemberJoined(matchId, teamId, socket.userId, io);
        if (result.error) {
          socket.emit('mapVeto:error', { error: result.error });
          return;
        }

        // Confirm to this player
        socket.emit('mapVeto:ready_ack', { matchId, teamId, status: result.status });

      } catch (error) {
        logger.error('socket_map_veto_ready_error', { socketId: socket.id, userId: socket.userId, error: error.message });
        socket.emit('error', { message: 'Failed to ready up for veto' });
      }
    });

    // Player leaves the veto room
    socket.on('mapVeto:left', async ({ matchId }) => {
      try {
        const { default: mapVetoService } = await import('../services/mapVeto.service.js');
        const { default: RegistrationModel } = await import('../models/registration.model.js');
        const { default: MatchModel } = await import('../models/match.model.js');

        const match = await MatchModel.findById(matchId).select('tournament').lean();
        if (!match) return;

        const reg = await RegistrationModel.findOne({
          tournament: match.tournament,
          'roster.player': socket.userId,
        }).select('team').lean();

        if (reg) {
          mapVetoService.teamMemberLeft(matchId, reg.team.toString(), socket.userId);
        }
        socket.leave(`match:${matchId}`);
      } catch (error) {
        logger.error('socket_map_veto_left_error', { socketId: socket.id, error: error.message });
      }
    });

    // Ban/pick action
    socket.on('mapVeto:action', async ({ matchId, map }) => {
      try {
        if (isSocketTokenExpired(socket)) { rejectExpiredSocket(socket); return; }

        const { default: mapVetoService } = await import('../services/mapVeto.service.js');
        const { default: RegistrationModel } = await import('../models/registration.model.js');
        const { default: MatchModel } = await import('../models/match.model.js');

        const match = await MatchModel.findById(matchId).select('tournament vsResults').lean();
        if (!match) { socket.emit('error', { message: 'Match not found' }); return; }

        const reg = await RegistrationModel.findOne({
          tournament: match.tournament,
          'roster.player': socket.userId,
        }).select('team').lean();

        if (!reg) { socket.emit('error', { message: 'Not authorized for this match' }); return; }

        const teamId = reg.team.toString();
        // Security: verify this team is actually a participant in this specific match
        const matchTeamA = match.vsResults?.teamA?.toString();
        const matchTeamB = match.vsResults?.teamB?.toString();
        if (teamId !== matchTeamA && teamId !== matchTeamB) {
          socket.emit('error', { message: 'Your team is not part of this match' });
          return;
        }

        const result = mapVetoService.processAction(matchId, teamId, map, io);

        if (!result.success) { socket.emit('mapVeto:error', { error: result.error }); return; }

        io.to(`match:${matchId}`).emit('mapVeto:updated', result.state);

        if (result.state.status === 'completed') {
          io.to(`match:${matchId}`).emit('mapVeto:completed', result.state);
        }
      } catch (error) {
        logger.error('socket_map_veto_action_error', { socketId: socket.id, userId: socket.userId, error: error.message });
        socket.emit('error', { message: 'Veto action failed' });
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
