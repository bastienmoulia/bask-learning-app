import { deleteApp } from 'firebase/app';
import { defaultFirebaseAppName, getFirebaseServices, hasFirebaseConfig } from './firebase';

describe('firebase helpers', () => {
  it('detects when required Firebase values are missing', () => {
    expect(
      hasFirebaseConfig({
        apiKey: '',
        authDomain: 'demo.firebaseapp.com',
        projectId: 'demo-project',
        appId: 'demo-app-id',
      }),
    ).toBe(false);
  });

  it('returns demo-mode services when Firebase is not configured', () => {
    const services = getFirebaseServices(
      {
        apiKey: '',
        authDomain: '',
        projectId: '',
        appId: '',
      },
      defaultFirebaseAppName,
    );

    expect(services.isConfigured).toBe(false);
    expect(services.app).toBeNull();
    expect(services.appCheck).toBeNull();
    expect(services.auth).toBeNull();
    expect(services.firestore).toBeNull();
    expect(services.functions).toBeNull();
    expect(services.appCheckEnabled).toBe(false);
  });

  it('initializes Firebase services when a complete config is provided', async () => {
    const appName = 'bask-learning-app-test';
    const services = getFirebaseServices(
      {
        apiKey: 'demo-api-key',
        authDomain: 'demo.firebaseapp.com',
        projectId: 'demo-project',
        appId: '1:1234567890:web:demo',
        messagingSenderId: '1234567890',
      },
      appName,
    );

    expect(services.isConfigured).toBe(true);
    expect(services.app?.name).toBe(appName);
    expect(services.auth).not.toBeNull();
    expect(services.firestore).not.toBeNull();
    expect(services.functions).not.toBeNull();
    expect(services.appCheckEnabled).toBe(false);

    await deleteApp(services.app!);
  });
});
