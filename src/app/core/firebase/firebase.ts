import { InjectionToken } from '@angular/core';
import { FirebaseApp, FirebaseOptions, getApps, initializeApp } from 'firebase/app';
import { AppCheck, initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { Functions, getFunctions } from 'firebase/functions';
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
  appCheck: AppCheck | null;
  auth: Auth | null;
  firestore: Firestore | null;
  functions: Functions | null;
  appCheckEnabled: boolean;
  isConfigured: boolean;
}

export const FIREBASE_SERVICES = new InjectionToken<FirebaseServices>('FIREBASE_SERVICES', {
  providedIn: 'root',
  factory: () => getFirebaseServices(),
});

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
      appCheck: null,
      auth: null,
      firestore: null,
      functions: null,
      appCheckEnabled: false,
      isConfigured: false,
    };
  }

  const existingApp = getApps().find((app) => app.name === appName);
  const app =
    existingApp ??
    (appName === defaultFirebaseAppName ? initializeApp(config) : initializeApp(config, appName));

  const appCheck = getAppCheck(app);

  return {
    app,
    appCheck,
    auth: getAuth(app),
    firestore: getFirestore(app),
    functions: getFunctions(app),
    appCheckEnabled: appCheck !== null,
    isConfigured: true,
  };
}

function getAppCheck(app: FirebaseApp) {
  const siteKey = environment.appCheck?.siteKey?.trim();

  if (!siteKey || typeof window === 'undefined') {
    return null;
  }

  const debugToken = environment.appCheck?.debugToken;

  if (debugToken) {
    (
      window as Window & { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }
    ).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
  }

  try {
    return initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: environment.appCheck?.isTokenAutoRefreshEnabled ?? true,
    });
  } catch {
    return null;
  }
}
