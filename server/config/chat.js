// Firebase Admin SDK for FCM
import admin from 'firebase-admin';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const serviceAccount = require('../aegis-app-88edd-firebase-adminsdk-fbsvc-456276ea78.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
import { Server } from 'socket.io';
import Player from '../models/player.model.js';
import TryoutChat from '../models/tryoutChat.model.js';

const initChat = (server) => {
  const io = new Server(server, {
    cors: {
      origin: [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:3000',
        'http://swayam-vite-site-12345.s3-website.ap-south-1.amazonaws.com',
        'http://13.232.101.212:5173',
        'http://13.232.101.212:5174'
      ],
      credentials: true,
      methods: ["GET", "POST"]
    },
  });


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
        await chat.populate('messages.sender', 'username profilePicture');
        const populatedMessage = chat.messages[chat.messages.length - 1];

        // Broadcast to all in room
        io.to(`tryout_${chatId}`).emit('newTryoutMessage', {
          chatId,
          message: populatedMessage
        });

        // Push Notification (FCM) for all mobile recipients except sender
        const Player = (await import('../models/player.model.js')).default;
        const recipientIds = chat.participants.filter(p => p.toString() !== senderId);
        if (recipientIds.length > 0) {
          const recipients = await Player.find({ _id: { $in: recipientIds } }).select('fcmToken username');
          const tokens = recipients.map(r => r.fcmToken).filter(Boolean);
          if (tokens.length > 0) {
            // Log FCM tokens being notified
            console.log('🔔 Sending FCM push to tokens:', tokens);
            // Get sender's name
            const sender = await Player.findById(senderId).select('username');
            const senderName = sender ? sender.username : 'Someone';
            try {
              // Use sendEachForMulticast for better compatibility with firebase-admin v13+
              const response = await admin.messaging().sendEachForMulticast({
                notification: {
                  title: 'New Chat Message',
                  body: `${senderName}: ${message}`
                },
                data: {
                  type: 'chat_message',
                  chatId: chatId.toString(),
                  senderId: senderId.toString(),
                  senderName: senderName,
                  message: message,
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

              // DETAILED LOGGING - THIS IS IMPORTANT!
              console.log('✅ FCM send completed');
              console.log(`📊 Success: ${response.successCount}/${tokens.length}`);
              console.log(`❌ Failures: ${response.failureCount}`);

              // Log individual failures
              if (response.failureCount > 0) {
                response.responses.forEach((resp, idx) => {
                  if (!resp.success) {
                    console.error(`❌ Token ${idx} (${tokens[idx].substring(0, 20)}...) failed:`);
                    console.error(`   Error code: ${resp.error?.code}`);
                    console.error(`   Error message: ${resp.error?.message}`);

                    // Handle specific error cases
                    if (resp.error?.code === 'messaging/invalid-registration-token' ||
                      resp.error?.code === 'messaging/registration-token-not-registered') {
                      console.log(`   ⚠️ Token is invalid/expired. Should remove from database.`);
                    }
                  } else {
                    console.log(`✅ Token ${idx} sent successfully`);
                  }
                });
              } else {
                console.log('✅ All notifications sent successfully!');
              }

            } catch (err) {
              console.error('❌ FCM sendEachForMulticast error:', err);
              console.error('Error code:', err.code);
              console.error('Error message:', err.message);
              if (err.stack) {
                console.error('Stack trace:', err.stack);
              }
            }
          }
        }

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
