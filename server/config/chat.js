import { Server } from 'socket.io';
import Player from '../models/player.model.js';
import TryoutChat from '../models/tryoutChat.model.js';

const initChat = (server) => {
  const io = new Server(server, {
    cors: {
      origin: 'http://localhost:5173',
      credentials: true,
    },
  });

  global.io = io;

  io.on('connection', (socket) => {
    console.log('✅ New Client Joined', socket.id);

    // ✅ Join user's personal room
    socket.on('joinRoom', async (userId) => {
      try {
        const player = await Player.findById(userId);
        if (player) {
          socket.join(userId);
          console.log(`Player ${userId} joined room`);
        }
      } catch (error) {
        console.error('Error joining room:', error);
      }
    });

    // ✅ NEW: Join tryout chat room
    socket.on('joinTryoutChat', async (chatId) => {
      try {
        const roomName = `tryout_${chatId}`;
        socket.join(roomName);
        console.log(`Socket ${socket.id} joined tryout room: ${roomName}`);

        // Confirm join to client
        socket.emit('tryoutChatJoined', { chatId, roomName });
      } catch (error) {
        console.error('Error joining tryout chat:', error);
        socket.emit('error', { message: 'Failed to join tryout chat' });
      }
    });

    // ✅ NEW: Leave tryout chat room
    socket.on('leaveTryoutChat', (chatId) => {
      const roomName = `tryout_${chatId}`;
      socket.leave(roomName);
      console.log(`Socket ${socket.id} left tryout room: ${roomName}`);
    });

    // ✅ NEW: Send message in tryout chat
    socket.on('sendTryoutMessage', async ({ chatId, message, senderId }) => {
      try {
        const chat = await TryoutChat.findById(chatId);

        if (!chat) {
          socket.emit('error', { message: 'Chat not found' });
          return;
        }

        // Verify sender is participant
        if (!chat.participants.some(p => p.toString() === senderId)) {
          socket.emit('error', { message: 'Not authorized' });
          return;
        }

        const newMessage = {
          sender: senderId,
          message: message.trim(),
          messageType: 'text',
          timestamp: new Date()
        };

        chat.messages.push(newMessage);
        await chat.save();

        // Populate sender info for response
        await chat.populate('messages.sender', 'username profilePicture inGameName');
        const populatedMessage = chat.messages[chat.messages.length - 1];

        // ✅ Broadcast to all in room
        io.to(`tryout_${chatId}`).emit('newTryoutMessage', {
          chatId,
          message: populatedMessage
        });

      } catch (error) {
        console.error('Error sending tryout message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('disconnect', () => {
      console.log('❌ Client disconnected:', socket.id);
    });
  });

  return io;
};

export default initChat;
