import { TestBed } from '@angular/core/testing';
import { Auth } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';
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
    getAuth: vi.fn(() => ({} as Auth)),
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

const firebaseFirestoreMocks = vi.hoisted(() => {
  let profileSnapshotCallback:
    | ((snapshot: { exists: () => boolean; data: () => unknown }) => void)
    | undefined;

  return {
    profileSnapshotCallback: () => profileSnapshotCallback,
    doc: vi.fn((_firestore: Firestore, collectionPath: string, documentId: string) => ({
      collectionPath,
      documentId,
    })),
    getFirestore: vi.fn(() => ({}) as Firestore),
    getDoc: vi.fn().mockResolvedValue({
      exists: () => false,
      data: () => undefined,
    }),
    setDoc: vi.fn().mockResolvedValue(undefined),
    onSnapshot: vi.fn((_docRef, onNext: (snapshot: { exists: () => boolean; data: () => unknown }) => void) => {
      profileSnapshotCallback = onNext;
      return vi.fn();
    }),
  };
});

vi.mock('firebase/firestore', () => firebaseFirestoreMocks);

interface MockUser {
  uid: string;
  displayName: string | null;
  email: string | null;
}

describe('AuthService', () => {
  let service: AuthService;

  function configureAuthService(options?: Partial<FirebaseServices>) {
    const mockAuth = {} as Auth;
    const mockFirestore = {} as Firestore;

    TestBed.configureTestingModule({
      providers: [
        {
          provide: FIREBASE_SERVICES,
          useValue: {
            app: null,
            appCheck: null,
            auth: mockAuth,
            firestore: mockFirestore,
            functions: null,
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
    firebaseFirestoreMocks.doc.mockClear();
    firebaseFirestoreMocks.getDoc.mockReset().mockResolvedValue({
      exists: () => false,
      data: () => undefined,
    });
    firebaseFirestoreMocks.setDoc.mockReset().mockResolvedValue(undefined);
    firebaseFirestoreMocks.onSnapshot.mockClear();
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
      role: 'learner',
    });
  });

  it('provisions a missing Firestore profile and reflects admin role changes', async () => {
    configureAuthService();
    await vi.waitFor(() => expect(firebaseAuthMocks.onAuthStateChanged).toHaveBeenCalledTimes(1));

    firebaseAuthMocks.authStateChangedCallback()?.({
      uid: 'admin-123',
      displayName: 'Ane Admin',
      email: 'ane@example.com',
    });
    await service.whenReady();

    expect(firebaseFirestoreMocks.setDoc).toHaveBeenCalledTimes(1);
    expect(service.learner()?.role).toBe('learner');

    firebaseFirestoreMocks.profileSnapshotCallback()?.({
      exists: () => true,
      data: () => ({
        uid: 'admin-123',
        displayName: 'Ane Admin',
        email: 'ane@example.com',
        role: 'admin',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
    });

    expect(service.learner()?.role).toBe('admin');
    expect(service.isAdmin()).toBe(true);
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
      firestore: null,
      isConfigured: false,
    });

    await service.whenReady();

    expect(service.isSignedIn()).toBe(false);
    expect(service.feedback()?.text).toContain('not configured');
  });
});
