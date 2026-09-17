import { FirebaseApp, FirebaseOptions, getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { environment } from '../../../environments/environment';

const requiredFirebaseKeys: (keyof FirebaseOptions)[] = [
  'apiKey',
  'authDomain',
  'projectId',
  'appId',
];

export interface FirebaseServices {
  app: FirebaseApp | null;
  auth: Auth | null;
  firestore: Firestore | null;
  isConfigured: boolean;
}

export function hasFirebaseConfig(config: Partial<FirebaseOptions>): config is FirebaseOptions {
  return requiredFirebaseKeys.every((key) => Boolean(config[key]?.toString().trim()));
}

export function getFirebaseServices(): FirebaseServices {
  if (!hasFirebaseConfig(environment.firebase)) {
    return {
      app: null,
      auth: null,
      firestore: null,
      isConfigured: false,
    };
  }

  const app = getApps().length ? getApp() : initializeApp(environment.firebase);

  return {
    app,
    auth: getAuth(app),
    firestore: getFirestore(app),
    isConfigured: true,
  };
}
