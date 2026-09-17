import type { FirebaseOptions } from 'firebase/app';

export interface AppEnvironment {
  production: boolean;
  firebase: Partial<FirebaseOptions>;
}

export const environment: AppEnvironment = {
  production: false,
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
  },
};
