import { computed, Injectable, signal } from '@angular/core';

const learnerProgressStorageKey = 'bask.learnerProgress';

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
  private readonly progressSignal = signal<LearnerDashboardProgress>(this.loadProgress());

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

  recordLessonCompletion(
    lessonId: string,
    title: string,
    totalSteps: number,
    correctAnswers: number,
  ) {
    const currentProgress = this.progress();
    const existingSummary = currentProgress.lessonSummaries[lessonId];
    const lastPlayedAt = new Date().toISOString();
    const updatedProgress: LearnerDashboardProgress = {
      ...currentProgress,
      streakDays: Math.max(currentProgress.streakDays, 1),
      totalXp: currentProgress.totalXp + 15,
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
  }

  private loadProgress(): LearnerDashboardProgress {
    const rawProgress = localStorage.getItem(learnerProgressStorageKey);

    if (!rawProgress) {
      return {
        streakDays: 0,
        totalXp: 0,
        lessonsCompleted: 0,
        currentPathLabel: 'Basque basics',
        lessonSummaries: {},
      };
    }

    try {
      return JSON.parse(rawProgress) as LearnerDashboardProgress;
    } catch {
      localStorage.removeItem(learnerProgressStorageKey);
      return {
        streakDays: 0,
        totalXp: 0,
        lessonsCompleted: 0,
        currentPathLabel: 'Basque basics',
        lessonSummaries: {},
      };
    }
  }

  private persist(progress: LearnerDashboardProgress) {
    localStorage.setItem(learnerProgressStorageKey, JSON.stringify(progress));
    this.progressSignal.set(progress);
  }
}
