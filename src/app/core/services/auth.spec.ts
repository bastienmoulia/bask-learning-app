import { TestBed } from '@angular/core/testing';
import { Auth } from 'firebase/auth';
import { vi } from 'vitest';
import { FIREBASE_SERVICES, type FirebaseServices } from '../firebase/firebase';
import { AuthService } from './auth';

const firebaseAuthMocks = vi.hoisted(() => {
  let authStateChangedCallback: ((user: MockUser | null) => void) | undefined;
  let authStateChangedErrorCallback: ((error: unknown) => void) | undefined;

  return {
    authStateChangedCallback: () => authStateChangedCallback,
    authStateChangedErrorCallback: () => authStateChangedErrorCallback,
    setPersistence: vi.fn().mockResolvedValue(undefined),
    getRedirectResult: vi.fn().mockResolvedValue(null),
    createUserWithEmailAndPassword: vi.fn().mockResolvedValue(undefined),
    signInWithEmailAndPassword: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    signInWithPopup: vi.fn().mockResolvedValue(undefined),
    signInWithRedirect: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    onAuthStateChanged: vi.fn(
      (
        _auth: Auth,
        onNext: (user: MockUser | null) => void,
        onError?: (error: unknown) => void,
      ) => {
        authStateChangedCallback = onNext;
        authStateChangedErrorCallback = onError;
        return vi.fn();
      },
    ),
    GoogleAuthProvider: class {},
    OAuthProvider: class {
      constructor(readonly providerId: string) {}
    },
    browserLocalPersistence: { type: 'LOCAL' },
  };
});

vi.mock('firebase/auth', () => firebaseAuthMocks);

interface MockUser {
  uid: string;
  displayName: string | null;
  email: string | null;
}

describe('AuthService', () => {
  let service: AuthService;

  function configureAuthService(options?: Partial<FirebaseServices>) {
    const mockAuth = {} as Auth;

    TestBed.configureTestingModule({
      providers: [
        {
          provide: FIREBASE_SERVICES,
          useValue: {
            app: null,
            appCheck: null,
            auth: mockAuth,
            firestore: null,
            appCheckEnabled: false,
            isConfigured: true,
            ...options,
          } satisfies FirebaseServices,
        },
      ],
    });

    service = TestBed.inject(AuthService);
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    firebaseAuthMocks.setPersistence.mockReset().mockResolvedValue(undefined);
    firebaseAuthMocks.getRedirectResult.mockReset().mockResolvedValue(null);
    firebaseAuthMocks.createUserWithEmailAndPassword.mockReset().mockResolvedValue(undefined);
    firebaseAuthMocks.signInWithEmailAndPassword.mockReset().mockResolvedValue(undefined);
    firebaseAuthMocks.sendPasswordResetEmail.mockReset().mockResolvedValue(undefined);
    firebaseAuthMocks.signInWithPopup.mockReset().mockResolvedValue(undefined);
    firebaseAuthMocks.signInWithRedirect.mockReset().mockResolvedValue(undefined);
    firebaseAuthMocks.signOut.mockReset().mockResolvedValue(undefined);
    firebaseAuthMocks.onAuthStateChanged.mockClear();
  });

  it('restores the Firebase learner from auth state changes', async () => {
    configureAuthService();
    await vi.waitFor(() => expect(firebaseAuthMocks.onAuthStateChanged).toHaveBeenCalledTimes(1));

    expect(service.isLoading()).toBe(true);

    firebaseAuthMocks.authStateChangedCallback()?.({
      uid: 'learner-123',
      displayName: null,
      email: 'learner@example.com',
    });
    await service.whenReady();

    expect(service.isLoading()).toBe(false);
    expect(service.isSignedIn()).toBe(true);
    expect(service.learner()).toEqual({
      id: 'learner-123',
      displayName: 'learner@example.com',
      email: 'learner@example.com',
    });
  });

  it('shows a friendly sign-in error when a popup is cancelled', async () => {
    configureAuthService();
    await vi.waitFor(() => expect(firebaseAuthMocks.onAuthStateChanged).toHaveBeenCalledTimes(1));
    firebaseAuthMocks.authStateChangedCallback()?.(null);
    await service.whenReady();

    firebaseAuthMocks.signInWithPopup.mockRejectedValueOnce({
      code: 'auth/popup-closed-by-user',
    });

    await service.signInWithGoogle();

    expect(service.feedback()?.kind).toBe('error');
    expect(service.feedback()?.text).toContain('cancelled');
  });

  it('signs out the learner and clears the session state', async () => {
    configureAuthService();
    await vi.waitFor(() => expect(firebaseAuthMocks.onAuthStateChanged).toHaveBeenCalledTimes(1));

    firebaseAuthMocks.authStateChangedCallback()?.({
      uid: 'learner-123',
      displayName: 'Learner',
      email: 'learner@example.com',
    });
    await service.whenReady();

    firebaseAuthMocks.signOut.mockImplementationOnce(async () => {
      firebaseAuthMocks.authStateChangedCallback()?.(null);
    });

    await service.signOut();

    expect(firebaseAuthMocks.signOut).toHaveBeenCalledTimes(1);
    expect(service.isSignedIn()).toBe(false);
    expect(service.learner()).toBeNull();
  });

  it('reports missing Firebase configuration without creating a local guest', async () => {
    configureAuthService({
      auth: null,
      isConfigured: false,
    });

    await service.whenReady();

    expect(service.isSignedIn()).toBe(false);
    expect(service.feedback()?.text).toContain('not configured');
  });
});
