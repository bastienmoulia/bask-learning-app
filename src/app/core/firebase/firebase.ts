import { FirebaseApp, FirebaseOptions, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { environment } from '../../../environments/environment';

export const defaultFirebaseAppName = '[DEFAULT]';

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

export function getFirebaseServices(
  config: Partial<FirebaseOptions> = environment.firebase,
  appName = defaultFirebaseAppName,
): FirebaseServices {
  if (!hasFirebaseConfig(config)) {
    return {
      app: null,
      auth: null,
      firestore: null,
      isConfigured: false,
    };
  }

  const existingApp = getApps().find((app) => app.name === appName);
  const app =
    existingApp ??
    (appName === defaultFirebaseAppName ? initializeApp(config) : initializeApp(config, appName));

  return {
    app,
    auth: getAuth(app),
    firestore: getFirestore(app),
    isConfigured: true,
  };
}
