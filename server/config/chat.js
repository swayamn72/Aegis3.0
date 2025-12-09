import { Server } from 'socket.io';
import ChatMessage from '../models/chat.model.js';

export default function initChat(server) {
  const io = new Server(server, {
    cors: {
      origin: 'http://localhost:5173', // update if needed
      credentials: true,
    },
  });

  // Make io globally available for REST routes
  global.io = io;

  io.on('connection', (socket) => {
    console.log('✅ New Client Joined', socket.id);

    socket.on('join', (playerId) => {
      socket.join(playerId);
      console.log(`Player ${playerId} joined room`);
    });

    // Direct 1-to-1 message
    socket.on('sendMessage', async ({ senderId, receiverId, message }) => {
      console.log(`${senderId} -> ${receiverId}: ${message}`);

      const msgData = {
        senderId,
        receiverId,
        message,
        timestamp: new Date(),
      };

      try {
        const savedMessage = await ChatMessage.create(msgData);

        const msgToEmit = {
          _id: savedMessage._id,
          ...msgData,
        };

        io.to(receiverId).emit('receiveMessage', msgToEmit);
      } catch (error) {
        console.error('❌ Error saving message:', error);
      }
    });

    // JOIN TRYOUT/GROUP CHAT
    socket.on('joinTryoutChat', (chatId) => {
      socket.join(`tryout_${chatId}`);
      console.log(`Joined tryout room: tryout_${chatId}`);
    });

    // LEAVE TRYOUT/GROUP CHAT
    socket.on('leaveTryoutChat', (chatId) => {
      socket.leave(`tryout_${chatId}`);
      console.log(`Left tryout room: tryout_${chatId}`);
    });

    // TRYOUT MESSAGE
    socket.on('tryoutMessage', async ({ chatId, senderId, message }) => {
      try {
        const TryoutChat = (await import('../models/tryoutChat.model.js')).default;

        const chat = await TryoutChat.findById(chatId);
        if (!chat) return;

        const newMessage = {
          sender: senderId,
          message,
          messageType: 'text',
          timestamp: new Date()
        };

        chat.messages.push(newMessage);
        await chat.save();

        const savedMessage = chat.messages[chat.messages.length - 1];

        io.to(`tryout_${chatId}`).emit('tryoutMessage', {
          chatId,
          message: savedMessage,
        });
      } catch (error) {
        console.error('❌ Tryout message error:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log('❌ Client disconnected:', socket.id);
    });
  });
}
