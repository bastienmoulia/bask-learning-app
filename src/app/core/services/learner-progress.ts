import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { AuthService } from './auth';

const learnerProgressStorageKeyPrefix = 'bask.learnerProgress';

export interface LessonCompletionSummary {
  lessonId: string;
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

@Injectable({
  providedIn: 'root',
})
export class LearnerProgressService {
  private readonly authService = inject(AuthService);
  private readonly progressSignal = signal<LearnerDashboardProgress>(createEmptyProgress());

  readonly progress = this.progressSignal.asReadonly();
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
      this.progressSignal.set(this.loadProgress(this.authService.learner()?.id ?? null));
    });
  }

  recordLessonCompletion(
    lessonId: string,
    title: string,
    totalSteps: number,
    correctAnswers: number,
  ) {
    if (!this.authService.learner()) {
      return 0;
    }

    const currentProgress = this.progress();
    const existingSummary = currentProgress.lessonSummaries[lessonId];
    const lastPlayedAt = new Date().toISOString();
    const xpAward = existingSummary ? 0 : 15;
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

  private loadProgress(learnerId: string | null): LearnerDashboardProgress {
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
    const storageKey = this.getStorageKey(this.authService.learner()?.id ?? null);

    if (!storageKey) {
      return;
    }

    localStorage.setItem(storageKey, JSON.stringify(progress));
    this.progressSignal.set(progress);
  }

  private getStorageKey(learnerId: string | null) {
    return learnerId ? `${learnerProgressStorageKeyPrefix}:${learnerId}` : null;
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
