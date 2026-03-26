import admin from 'firebase-admin';

// Import the service account JSON
// Adjusting path if it's placed in the server root
import serviceAccount from '../aegis3-cbfba-firebase-adminsdk-fbsvc-b7e1b5653b.json' with { type: 'json' };

try {
  // Initialize the app only if there are no existing apps
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin SDK initialized successfully.');
  }
} catch (error) {
  console.error('Firebase Admin Initialization Error:', error.message);
}

export default admin;
