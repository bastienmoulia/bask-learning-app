import { computed, Injectable, signal } from '@angular/core';
import { getFirebaseServices } from '../firebase/firebase';

const demoLearnerStorageKey = 'bask.demoLearner';

function createGuestId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `guest-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export interface LearnerSession {
  id: string;
  displayName: string;
  mode: 'demo' | 'firebase-ready';
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly firebase = getFirebaseServices();
  private readonly learnerSignal = signal<LearnerSession | null>(this.loadStoredLearner());

  readonly learner = this.learnerSignal.asReadonly();
  readonly isSignedIn = computed(() => this.learner() !== null);
  readonly connectionLabel = computed(() =>
    this.firebase.isConfigured ? 'Firebase configured' : 'Demo mode · Firebase not configured yet',
  );

  continueAsGuest() {
    if (this.learner()) {
      return this.learner();
    }

    const learner: LearnerSession = {
      id: createGuestId(),
      displayName: 'Guest explorer',
      mode: this.firebase.isConfigured ? 'firebase-ready' : 'demo',
    };

    localStorage.setItem(demoLearnerStorageKey, JSON.stringify(learner));
    this.learnerSignal.set(learner);

    return learner;
  }

  signOut() {
    localStorage.removeItem(demoLearnerStorageKey);
    this.learnerSignal.set(null);
  }

  private loadStoredLearner(): LearnerSession | null {
    const rawLearner = localStorage.getItem(demoLearnerStorageKey);

    if (!rawLearner) {
      return null;
    }

    try {
      return JSON.parse(rawLearner) as LearnerSession;
    } catch {
      localStorage.removeItem(demoLearnerStorageKey);
      return null;
    }
  }
}
