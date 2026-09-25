import type { FirebaseOptions } from 'firebase/app';

export interface AppEnvironment {
  production: boolean;
  functionsRegion?: string;
  appCheck?: {
    siteKey?: string;
    debugToken?: string | boolean;
    isTokenAutoRefreshEnabled?: boolean;
  };
  ai?: {
    practiceModel?: string;
    maxPracticeRequestsPerHour?: number;
  };
  firebase: Partial<FirebaseOptions>;
}

export const environment: AppEnvironment = {
  production: false,
  functionsRegion: 'europe-west1',
  appCheck: {},
  ai: {
    practiceModel: 'gemini-3.5-flash-lite',
    maxPracticeRequestsPerHour: 3,
  },
  firebase: {
    apiKey: 'AIzaSyDN_rBWJjVupuO4PhttQdy80he_rMFAMbc',
    authDomain: 'bask-learning-app.firebaseapp.com',
    projectId: 'bask-learning-app',
    storageBucket: 'bask-learning-app.firebasestorage.app',
    messagingSenderId: '218857568810',
    appId: '1:218857568810:web:d303f146da0a3270f8a153',
  },
};
