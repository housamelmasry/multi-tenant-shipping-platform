import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

const logger = new Logger('Firebase');

export const initializeFirebase = (config: ConfigService) => {
  if (admin.apps.length > 0) return;

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: config.get('FIREBASE_PROJECT_ID'),
        clientEmail: config.get('FIREBASE_CLIENT_EMAIL'),
        privateKey: config.get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
      }),
    });
  } catch (err) {
    logger.warn(`⏭️ Firebase disabled — ${err.message}`);
  }
};

export const getFirebaseMessaging = () => admin.messaging();
