// src/config/firebase.config.ts
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';

export const initializeFirebase = (config: ConfigService) => {
  if (admin.apps.length > 0) return; // منع التهيئة المكررة

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: config.get('FIREBASE_PROJECT_ID'),
      clientEmail: config.get('FIREBASE_CLIENT_EMAIL'),
      privateKey: config.get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
    }),
  });
};

export const getFirebaseMessaging = () => admin.messaging();
