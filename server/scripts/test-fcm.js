/**
 * Standalone FCM Test Script (Aegis)
 * Usage: node scripts/test-fcm.js [type]
 * Types: match_scheduled, room_credentials, team_offer, tryout_ended
 */

import admin from '../config/firebase.js';

// The specific FCM token you provided
const FCM_TOKEN = 'crFwbt02TySZ17_UKo9syB:APA91bH8TDrWkIkhrdfYg8VuA3P9hlcRyD9oO9ltH3uj5wbiY4iFkvxiBOtcRCjfyveuJvTt61sDF3M6MQ04nFRFDlBcSC9j1KR8_PvflirI-Adhm40rb0A';

const type = process.argv[2] || 'test';

const getPayload = (type) => {
  const mockId = '65f1a2b3c4d5e6f7a8b9c0d1';
  switch (type) {
    case 'match_scheduled':
      return {
        notification: { title: '📅 Match Scheduled', body: 'Test Match in Pro League - Phase 1' },
        data: { type, matchId: mockId, tournamentId: mockId }
      };
    case 'room_credentials':
      return {
        notification: { title: '🔑 Room Credentials Shared', body: 'Match #1 - ID: 123456 | Pass: aegis' },
        data: { type, matchId: mockId, tournamentId: mockId }
      };
    case 'team_offer':
      return {
        notification: { title: '🏆 Team Offer Received', body: 'Team Storm has sent you a join offer!' },
        data: { type, chatId: mockId }
      };
    case 'tryout_ended':
      return {
        notification: { title: '❌ Tryout Ended', body: 'Your tryout with Team Storm has ended.' },
        data: { type, chatId: mockId }
      };
    default:
      return {
        notification: { title: 'Test Push', body: 'Standalone test message from CLI' },
        data: { type: 'test' }
      };
  }
};

const sendTest = async () => {
  try {
    const payload = getPayload(type);
    const message = {
      ...payload,
      token: FCM_TOKEN
    };

    console.log(`🚀 Sending ${type} notification to token...`);
    const response = await admin.messaging().send(message);
    console.log('✅ Successfully sent message:', response);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error sending message:', error.message);
    process.exit(1);
  }
};

sendTest();
