import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { collection, onSnapshot, orderBy, query, Unsubscribe } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { FIREBASE_SERVICES } from '../firebase/firebase';
import { AuthService } from './auth';
import { parseUserProfileDocument, usersCollection, UserProfileDocument, UserRole } from './user-profiles';

const setUserRoleCallableName = 'setUserRole';

export interface AdminUsersFeedback {
  kind: 'error' | 'success';
  text: string;
}

@Injectable({
  providedIn: 'root',
})
export class AdminUsersService {
  private readonly authService = inject(AuthService);
  private readonly firebase = inject(FIREBASE_SERVICES);
  private readonly usersSignal = signal<UserProfileDocument[]>([]);
  private readonly feedbackSignal = signal<AdminUsersFeedback | null>(null);
  private readonly loadingSignal = signal(false);
  private readonly activeUserIdSignal = signal<string | null>(null);
  private usersUnsubscribe?: Unsubscribe;

  readonly users = this.usersSignal.asReadonly();
  readonly feedback = this.feedbackSignal.asReadonly();
  readonly isLoading = this.loadingSignal.asReadonly();
  readonly activeUserId = this.activeUserIdSignal.asReadonly();
  readonly canManageUsers = computed(
    () => this.authService.isAdmin() && !!this.firebase.firestore && !!this.firebase.functions,
  );

  constructor() {
    effect(() => {
      const currentLearner = this.authService.learner();
      const isAdmin = currentLearner?.role === 'admin';

      this.usersUnsubscribe?.();
      this.usersUnsubscribe = undefined;
      this.usersSignal.set([]);

      if (!isAdmin || !this.firebase.firestore) {
        this.loadingSignal.set(false);
        return;
      }

      this.loadingSignal.set(true);
      this.usersUnsubscribe = onSnapshot(
        query(
          collection(this.firebase.firestore, usersCollection),
          orderBy('displayName'),
        ),
        (snapshot) => {
          this.usersSignal.set(
            snapshot.docs
              .map((documentSnapshot) =>
                parseUserProfileDocument(documentSnapshot.data(), documentSnapshot.id),
              )
              .filter((profile): profile is UserProfileDocument => profile !== null),
          );
          this.loadingSignal.set(false);
        },
        () => {
          this.loadingSignal.set(false);
          this.feedbackSignal.set({
            kind: 'error',
            text: 'We could not load the registered users right now. Please try again shortly.',
          });
        },
      );
    });
  }

  async setUserRole(targetUserId: string, nextRole: UserRole) {
    if (!this.firebase.functions) {
      this.feedbackSignal.set({
        kind: 'error',
        text: 'Firebase Functions is not configured for this app yet.',
      });
      return false;
    }

    this.activeUserIdSignal.set(targetUserId);
    this.feedbackSignal.set(null);

    try {
      const setUserRole = httpsCallable<
        { targetUserId: string; role: UserRole },
        { success: boolean }
      >(this.firebase.functions, setUserRoleCallableName);
      await setUserRole({
        targetUserId,
        role: nextRole,
      });
      this.feedbackSignal.set({
        kind: 'success',
        text:
          nextRole === 'admin'
            ? 'Administrator access granted.'
            : 'Administrator access revoked.',
      });
      return true;
    } catch {
      this.feedbackSignal.set({
        kind: 'error',
        text:
          nextRole === 'admin'
            ? 'We could not grant administrator access right now.'
            : 'We could not revoke administrator access right now.',
      });
      return false;
    } finally {
      this.activeUserIdSignal.set(null);
    }
  }
}
