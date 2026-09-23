import { computed, inject, Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  AuthError,
  AuthProvider,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getRedirectResult,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc, Unsubscribe } from 'firebase/firestore';
import { FIREBASE_SERVICES } from '../firebase/firebase';
import {
  createDefaultUserProfile,
  parseUserProfileDocument,
  syncUserProfileIdentity,
  usersCollection,
  UserRole,
} from './user-profiles';

export interface LearnerSession {
  id: string;
  displayName: string;
  email: string | null;
  role: UserRole;
}

export interface AuthFeedback {
  kind: 'error' | 'info' | 'success';
  text: string;
}

const missingFirebaseConfigMessage =
  'Firebase Authentication is not configured for this app yet. Add a valid Firebase web configuration before signing in.';

function createLearnerSession(user: User, role: UserRole): LearnerSession {
  return {
    id: user.uid,
    displayName: createDefaultUserProfile(user).displayName,
    email: user.email,
    role,
  };
}

export function getAuthErrorMessage(error: unknown, providerLabel = 'that provider') {
  const code = (error as Partial<AuthError> | null)?.code;

  switch (code) {
    case 'auth/cancelled-popup-request':
    case 'auth/popup-closed-by-user':
      return 'Sign-in was cancelled before it finished. Please try again.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in popup. Allow popups or try again.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized for Firebase sign-in yet. Add it to the Firebase Authentication authorized domains list.';
    case 'auth/operation-not-allowed':
      return `${providerLabel} sign-in is not available for this Firebase project yet.`;
    case 'auth/email-already-in-use':
      return 'An account already exists for that email address. Try signing in instead.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/missing-email':
      return 'Enter your email address to continue.';
    case 'auth/missing-password':
      return 'Enter your password to continue.';
    case 'auth/weak-password':
      return 'Choose a stronger password with at least 6 characters.';
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Incorrect email or password. Please try again.';
    case 'auth/network-request-failed':
      return 'The network request failed. Check your connection and try again.';
    case 'auth/web-storage-unsupported':
      return 'This browser cannot store a sign-in session. Try a different browser or device.';
    default:
      return 'We could not complete sign-in right now. Please try again.';
  }
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly firebase = inject(FIREBASE_SERVICES);
  private readonly learnerSignal = signal<LearnerSession | null>(null);
  private readonly loadingSignal = signal(true);
  private readonly feedbackSignal = signal<AuthFeedback | null>(null);
  private readonly authReadyPromise: Promise<void>;
  private resolveAuthReady?: () => void;
  private userProfileUnsubscribe?: Unsubscribe;

  readonly learner = this.learnerSignal.asReadonly();
  readonly isLoading = this.loadingSignal.asReadonly();
  readonly feedback = this.feedbackSignal.asReadonly();
  readonly isSignedIn = computed(() => this.learner() !== null);
  readonly isAdmin = computed(() => this.learner()?.role === 'admin');
  readonly isConfigured = this.firebase.isConfigured;

  constructor() {
    this.authReadyPromise = new Promise<void>((resolve) => {
      this.resolveAuthReady = resolve;
    });

    if (!this.firebase.isConfigured || !this.firebase.auth) {
      this.loadingSignal.set(false);
      this.feedbackSignal.set({
        kind: 'error',
        text: missingFirebaseConfigMessage,
      });
      this.finishAuthLoading();
      return;
    }

    void this.initializeFirebaseAuth();
  }

  async whenReady() {
    await this.authReadyPromise;
  }

  async registerWithEmail(email: string, password: string) {
    if (!this.firebase.auth) {
      this.setError(missingFirebaseConfigMessage);
      return false;
    }

    this.feedbackSignal.set(null);

    try {
      await createUserWithEmailAndPassword(this.firebase.auth, email.trim(), password);
      return true;
    } catch (error) {
      this.setError(getAuthErrorMessage(error, 'Email/password'));
      return false;
    }
  }

  async signInWithEmail(email: string, password: string) {
    if (!this.firebase.auth) {
      this.setError(missingFirebaseConfigMessage);
      return false;
    }

    this.feedbackSignal.set(null);

    try {
      await signInWithEmailAndPassword(this.firebase.auth, email.trim(), password);
      return true;
    } catch (error) {
      this.setError(getAuthErrorMessage(error, 'Email/password'));
      return false;
    }
  }

  async sendPasswordReset(email: string) {
    if (!this.firebase.auth) {
      this.setError(missingFirebaseConfigMessage);
      return false;
    }

    this.feedbackSignal.set(null);

    try {
      await sendPasswordResetEmail(this.firebase.auth, email.trim());
      this.feedbackSignal.set({
        kind: 'success',
        text: 'If an account exists for that email address, a password reset link has been sent.',
      });
      return true;
    } catch (error) {
      this.setError(getAuthErrorMessage(error, 'Password reset'));
      return false;
    }
  }

  async signInWithGoogle() {
    return this.signInWithProvider(new GoogleAuthProvider(), 'Google');
  }

  async signInWithApple() {
    return this.signInWithProvider(new OAuthProvider('apple.com'), 'Apple');
  }

  async signOut() {
    if (!this.firebase.auth) {
      this.learnerSignal.set(null);
      return true;
    }

    try {
      await firebaseSignOut(this.firebase.auth);
      this.feedbackSignal.set(null);
      return true;
    } catch (error) {
      this.setError(getAuthErrorMessage(error));
      return false;
    }
  }

  private async initializeFirebaseAuth() {
    const auth = this.firebase.auth;

    if (!auth) {
      return;
    }

    try {
      await setPersistence(auth, browserLocalPersistence);
    } catch (error) {
      this.setError(getAuthErrorMessage(error));
    }

    try {
      await getRedirectResult(auth);
    } catch (error) {
      this.setError(getAuthErrorMessage(error));
    }

    onAuthStateChanged(
      auth,
      (user) => {
        void this.handleAuthStateChange(user);
      },
      (error) => {
        this.learnerSignal.set(null);
        this.loadingSignal.set(false);
        this.setError(getAuthErrorMessage(error));
        this.finishAuthLoading();
      },
    );
  }

  private async handleAuthStateChange(user: User | null) {
    this.userProfileUnsubscribe?.();
    this.userProfileUnsubscribe = undefined;

    if (!user) {
      this.learnerSignal.set(null);
      this.loadingSignal.set(false);
      this.finishAuthLoading();
      return;
    }

    if (!this.firebase.firestore) {
      this.learnerSignal.set(createLearnerSession(user, 'learner'));
      this.loadingSignal.set(false);
      this.finishAuthLoading();
      return;
    }

    this.loadingSignal.set(true);

    try {
      const userDocRef = doc(this.firebase.firestore, usersCollection, user.uid);
      const userDoc = await getDoc(userDocRef);
      let profile = userDoc.exists() ? parseUserProfileDocument(userDoc.data(), user.uid) : null;

      if (!profile) {
        profile = createDefaultUserProfile(user);
        await setDoc(userDocRef, profile);
      } else {
        const syncedProfile = syncUserProfileIdentity(profile, user);

        if (syncedProfile.updatedAt !== profile.updatedAt) {
          profile = syncedProfile;
          await setDoc(userDocRef, profile);
        }
      }

      this.learnerSignal.set(createLearnerSession(user, profile.role));
      this.loadingSignal.set(false);
      this.finishAuthLoading();

      this.userProfileUnsubscribe = onSnapshot(
        userDocRef,
        (snapshot) => {
          const nextProfile = snapshot.exists()
            ? parseUserProfileDocument(snapshot.data(), user.uid)
            : null;

          if (!nextProfile) {
            this.learnerSignal.set(createLearnerSession(user, 'learner'));
            return;
          }

          this.learnerSignal.set(createLearnerSession(user, nextProfile.role));
        },
        () => {
          this.setError(
            'We could not refresh your account role right now. Some protected features may stay unavailable until the next successful sync.',
          );
        },
      );
    } catch {
      this.learnerSignal.set(createLearnerSession(user, 'learner'));
      this.loadingSignal.set(false);
      this.setError(
        'We could not prepare your learner profile in Firestore right now. Signed-in learning features may be limited until it succeeds.',
      );
      this.finishAuthLoading();
    }
  }

  private async signInWithProvider(provider: AuthProvider, providerLabel: string) {
    if (!this.firebase.auth) {
      this.setError(missingFirebaseConfigMessage);
      return false;
    }

    this.feedbackSignal.set(null);

    try {
      if (Capacitor.isNativePlatform()) {
        this.feedbackSignal.set({
          kind: 'info',
          text: `Continuing with ${providerLabel} sign-in…`,
        });
        await signInWithRedirect(this.firebase.auth, provider);
        return true;
      }

      await signInWithPopup(this.firebase.auth, provider);
      return true;
    } catch (error) {
      this.setError(getAuthErrorMessage(error, providerLabel));
      return false;
    }
  }

  private finishAuthLoading() {
    if (!this.resolveAuthReady) {
      return;
    }

    this.resolveAuthReady();
    this.resolveAuthReady = undefined;
  }

  private setError(message: string) {
    this.feedbackSignal.set({
      kind: 'error',
      text: message,
    });
  }
}
