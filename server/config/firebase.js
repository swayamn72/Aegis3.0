import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import logger from './logger.js';

const parseServiceAccountFromEnv = () => {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    return JSON.parse(rawJson);
  }

  const rawBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (rawBase64) {
    const decoded = Buffer.from(rawBase64, 'base64').toString('utf8');
    return JSON.parse(decoded);
  }

  return null;
};

const loadServiceAccount = () => {
  const envServiceAccount = parseServiceAccountFromEnv();
  if (envServiceAccount) {
    return envServiceAccount;
  }

  // Local-development fallback only.
  const fallbackPath = path.resolve(
    process.cwd(),
    'aegis3-cbfba-firebase-adminsdk-fbsvc-b7e1b5653b.json',
  );

  if (fs.existsSync(fallbackPath)) {
    const fileContents = fs.readFileSync(fallbackPath, 'utf8');
    return JSON.parse(fileContents);
  }

  return null;
};

try {
  // Initialize the app only if there are no existing apps
  if (!admin.apps.length) {
    const serviceAccount = loadServiceAccount();

    if (!serviceAccount) {
      throw new Error(
        'Missing Firebase credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_BASE64.',
      );
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    logger.info('firebase_admin_initialized');
  }
} catch (error) {
  logger.error('firebase_admin_initialization_error', { error: error.message });
}

export default admin;
