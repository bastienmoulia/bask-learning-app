import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { FIREBASE_SERVICES } from '../firebase/firebase';
import { AuthService } from './auth';

const learnerProgressStorageKeyPrefix = 'bask.learnerProgress';
const learnerProgressCollection = 'learnerProgress';
const lessonCompletionXp = 15;

export interface ProgressSyncFeedback {
  kind: 'error';
  text: string;
}

export interface LessonCompletionSummary {
  lessonId: string;
  lessonVersion: string;
  title: string;
  stepsCompleted: number;
  totalSteps: number;
  bestScore: number;
  lastPlayedAt: string;
}

export interface LearnerDashboardProgress {
  streakDays: number;
  totalXp: number;
  lessonsCompleted: number;
  currentPathLabel: string;
  lessonSummaries: Record<string, LessonCompletionSummary>;
}

interface LearnerProgressDocument extends LearnerDashboardProgress {
  uid: string;
  updatedAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class LearnerProgressService {
  private readonly authService = inject(AuthService);
  private readonly firebase = inject(FIREBASE_SERVICES);
  private readonly progressSignal = signal<LearnerDashboardProgress>(createEmptyProgress());
  private readonly syncFeedbackSignal = signal<ProgressSyncFeedback | null>(null);
  private restoreRequestId = 0;

  readonly progress = this.progressSignal.asReadonly();
  readonly syncFeedback = this.syncFeedbackSignal.asReadonly();
  readonly completionRate = computed(() => {
    const currentProgress = this.progress();
    const lessonCount = Object.keys(currentProgress.lessonSummaries).length;

    if (!lessonCount) {
      return 0;
    }

    const completedSteps = Object.values(currentProgress.lessonSummaries).reduce(
      (total, lesson) => total + lesson.stepsCompleted,
      0,
    );
    const totalSteps = Object.values(currentProgress.lessonSummaries).reduce(
      (total, lesson) => total + lesson.totalSteps,
      0,
    );

    return Math.round((completedSteps / totalSteps) * 100);
  });

  constructor() {
    effect(() => {
      const learnerId = this.authService.learner()?.id ?? null;
      const localProgress = this.loadLocalProgress(learnerId);

      this.restoreRequestId += 1;
      this.progressSignal.set(localProgress);
      this.syncFeedbackSignal.set(null);

      if (!learnerId) {
        return;
      }

      void this.restoreProgress(learnerId, localProgress, this.restoreRequestId);
    });
  }

  recordLessonCompletion(
    lessonId: string,
    title: string,
    lessonVersion: string,
    totalSteps: number,
    correctAnswers: number,
  ) {
    if (!this.authService.learner()) {
      return 0;
    }

    const currentProgress = this.progress();
    const existingSummary = currentProgress.lessonSummaries[lessonId];
    const lastPlayedAt = new Date().toISOString();
    const xpAward = existingSummary ? 0 : lessonCompletionXp;
    const updatedProgress: LearnerDashboardProgress = {
      ...currentProgress,
      streakDays: Math.max(currentProgress.streakDays, 1),
      totalXp: currentProgress.totalXp + xpAward,
      lessonsCompleted: existingSummary
        ? currentProgress.lessonsCompleted
        : currentProgress.lessonsCompleted + 1,
      lessonSummaries: {
        ...currentProgress.lessonSummaries,
        [lessonId]: {
          lessonId,
          lessonVersion,
          title,
          stepsCompleted: totalSteps,
          totalSteps,
          bestScore: Math.max(existingSummary?.bestScore ?? 0, correctAnswers),
          lastPlayedAt,
        },
      },
    };

    this.persist(updatedProgress);

    return xpAward;
  }

  private loadLocalProgress(learnerId: string | null): LearnerDashboardProgress {
    const storageKey = this.getStorageKey(learnerId);

    if (!storageKey) {
      return createEmptyProgress();
    }

    const rawProgress = localStorage.getItem(storageKey);

    if (!rawProgress) {
      return createEmptyProgress();
    }

    try {
      return JSON.parse(rawProgress) as LearnerDashboardProgress;
    } catch {
      localStorage.removeItem(storageKey);
      return createEmptyProgress();
    }
  }

  private persist(progress: LearnerDashboardProgress) {
    const learnerId = this.authService.learner()?.id ?? null;
    const storageKey = this.getStorageKey(learnerId);

    if (!storageKey) {
      return;
    }

    localStorage.setItem(storageKey, JSON.stringify(progress));
    this.progressSignal.set(progress);

    if (learnerId) {
      void this.syncRemoteProgress(learnerId, progress);
    }
  }

  private getStorageKey(learnerId: string | null) {
    return learnerId ? `${learnerProgressStorageKeyPrefix}:${learnerId}` : null;
  }

  private async restoreProgress(
    learnerId: string,
    localProgress: LearnerDashboardProgress,
    restoreRequestId: number,
  ) {
    const remoteProgress = await this.loadRemoteProgress(learnerId);

    if (!this.isLatestRestoreRequest(learnerId, restoreRequestId) || !remoteProgress) {
      return;
    }

    const mergedProgress = mergeProgress(localProgress, remoteProgress);

    if (isSameProgress(localProgress, mergedProgress)) {
      return;
    }

    this.persistLocalProgress(learnerId, mergedProgress);
    this.progressSignal.set(mergedProgress);

    if (!isSameProgress(remoteProgress, mergedProgress)) {
      await this.syncRemoteProgress(learnerId, mergedProgress);
    }
  }

  private async loadRemoteProgress(learnerId: string) {
    if (!this.firebase.isConfigured || !this.firebase.firestore) {
      return null;
    }

    try {
      const snapshot = await getDoc(
        doc(this.firebase.firestore, learnerProgressCollection, learnerId),
      );

      if (!snapshot.exists()) {
        return null;
      }

      return parseLearnerProgressDocument(snapshot.data(), learnerId);
    } catch {
      this.setSyncError(
        'We could not refresh your saved progress from your account. Showing the progress stored on this device instead.',
      );
      return null;
    }
  }

  private async syncRemoteProgress(learnerId: string, progress: LearnerDashboardProgress) {
    if (!this.firebase.isConfigured || !this.firebase.firestore) {
      return true;
    }

    try {
      await setDoc(
        doc(this.firebase.firestore, learnerProgressCollection, learnerId),
        createLearnerProgressDocument(learnerId, progress),
      );

      if (this.authService.learner()?.id === learnerId) {
        this.syncFeedbackSignal.set(null);
      }

      return true;
    } catch {
      this.setSyncError(
        'Your latest lesson progress is saved on this device, but we could not sync it to your account yet.',
      );
      return false;
    }
  }

  private persistLocalProgress(learnerId: string, progress: LearnerDashboardProgress) {
    const storageKey = this.getStorageKey(learnerId);

    if (!storageKey) {
      return;
    }

    localStorage.setItem(storageKey, JSON.stringify(progress));
  }

  private isLatestRestoreRequest(learnerId: string, restoreRequestId: number) {
    return (
      restoreRequestId === this.restoreRequestId && this.authService.learner()?.id === learnerId
    );
  }

  private setSyncError(message: string) {
    this.syncFeedbackSignal.set({
      kind: 'error',
      text: message,
    });
  }
}

function createEmptyProgress(): LearnerDashboardProgress {
  return {
    streakDays: 0,
    totalXp: 0,
    lessonsCompleted: 0,
    currentPathLabel: 'Basque basics',
    lessonSummaries: {},
  };
}

function createLearnerProgressDocument(
  learnerId: string,
  progress: LearnerDashboardProgress,
): LearnerProgressDocument {
  return {
    uid: learnerId,
    updatedAt: new Date().toISOString(),
    ...progress,
  };
}

function parseLearnerProgressDocument(
  data: unknown,
  learnerId: string,
): LearnerDashboardProgress | null {
  if (!isLearnerProgressDocument(data, learnerId)) {
    return null;
  }

  return {
    streakDays: data.streakDays,
    totalXp: data.totalXp,
    lessonsCompleted: data.lessonsCompleted,
    currentPathLabel: data.currentPathLabel,
    lessonSummaries: data.lessonSummaries,
  };
}

function isLearnerProgressDocument(
  data: unknown,
  learnerId: string,
): data is LearnerProgressDocument {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const progress = data as Partial<LearnerProgressDocument>;

  return (
    progress.uid === learnerId &&
    typeof progress.updatedAt === 'string' &&
    isLearnerDashboardProgress(progress)
  );
}

function isLearnerDashboardProgress(data: unknown): data is LearnerDashboardProgress {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const progress = data as Partial<LearnerDashboardProgress>;

  if (
    !Number.isFinite(progress.streakDays) ||
    !Number.isFinite(progress.totalXp) ||
    !Number.isFinite(progress.lessonsCompleted) ||
    typeof progress.currentPathLabel !== 'string' ||
    !progress.lessonSummaries ||
    typeof progress.lessonSummaries !== 'object'
  ) {
    return false;
  }

  return Object.entries(progress.lessonSummaries).every(([lessonId, summary]) =>
    isLessonCompletionSummary(summary, lessonId),
  );
}

function isLessonCompletionSummary(
  data: unknown,
  lessonId: string,
): data is LessonCompletionSummary {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const summary = data as Partial<LessonCompletionSummary>;

  return (
    summary.lessonId === lessonId &&
    typeof summary.lessonVersion === 'string' &&
    typeof summary.title === 'string' &&
    Number.isFinite(summary.stepsCompleted) &&
    Number.isFinite(summary.totalSteps) &&
    Number.isFinite(summary.bestScore) &&
    typeof summary.lastPlayedAt === 'string'
  );
}

function mergeProgress(
  localProgress: LearnerDashboardProgress,
  remoteProgress: LearnerDashboardProgress,
): LearnerDashboardProgress {
  const lessonIds = new Set([
    ...Object.keys(localProgress.lessonSummaries),
    ...Object.keys(remoteProgress.lessonSummaries),
  ]);
  const lessonSummaries = Object.fromEntries(
    [...lessonIds].map((lessonId) => {
      const localSummary = localProgress.lessonSummaries[lessonId];
      const remoteSummary = remoteProgress.lessonSummaries[lessonId];

      return [lessonId, mergeLessonSummary(lessonId, localSummary, remoteSummary)];
    }),
  ) as Record<string, LessonCompletionSummary>;

  return {
    streakDays: Math.max(localProgress.streakDays, remoteProgress.streakDays),
    totalXp: Math.max(localProgress.totalXp, remoteProgress.totalXp),
    lessonsCompleted: Math.max(
      localProgress.lessonsCompleted,
      remoteProgress.lessonsCompleted,
      Object.keys(lessonSummaries).length,
    ),
    currentPathLabel: localProgress.currentPathLabel || remoteProgress.currentPathLabel,
    lessonSummaries,
  };
}

function mergeLessonSummary(
  lessonId: string,
  localSummary?: LessonCompletionSummary,
  remoteSummary?: LessonCompletionSummary,
): LessonCompletionSummary {
  if (!localSummary) {
    return remoteSummary!;
  }

  if (!remoteSummary) {
    return localSummary;
  }

  const latestSummary =
    Date.parse(localSummary.lastPlayedAt) >= Date.parse(remoteSummary.lastPlayedAt)
      ? localSummary
      : remoteSummary;

  return {
    lessonId,
    title: latestSummary.title,
    lessonVersion: latestSummary.lessonVersion,
    stepsCompleted: Math.max(localSummary.stepsCompleted, remoteSummary.stepsCompleted),
    totalSteps: Math.max(localSummary.totalSteps, remoteSummary.totalSteps),
    bestScore: Math.max(localSummary.bestScore, remoteSummary.bestScore),
    lastPlayedAt: latestSummary.lastPlayedAt,
  };
}

function isSameProgress(left: LearnerDashboardProgress, right: LearnerDashboardProgress) {
  return JSON.stringify(left) === JSON.stringify(right);
}
