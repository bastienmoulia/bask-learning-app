import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { collection, onSnapshot, orderBy, query, Unsubscribe } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { FIREBASE_SERVICES } from '../firebase/firebase';
import { AuthService } from './auth';
import {
  LessonDraft,
  ManagedLesson,
  parseManagedLessonDocument,
  toLessonDraft,
  validateLessonDraft,
} from '../../features/lesson-player/starter-lesson';

const lessonsCollection = 'lessons';
const generateLessonDraftCallableName = 'generateLessonDraft';
const upsertLessonCallableName = 'upsertLesson';
const removeLessonCallableName = 'removeLesson';

export interface LessonGenerationRequest {
  topic: string;
  level: string;
  learningGoals: string;
}

export interface AdminLessonsFeedback {
  kind: 'error' | 'success' | 'info';
  text: string;
}

export interface GeneratedLessonDraftResult {
  draft: LessonDraft;
  validationErrors: string[];
  source: 'ai' | 'template';
  feedback: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class AdminLessonsService {
  private readonly authService = inject(AuthService);
  private readonly firebase = inject(FIREBASE_SERVICES);
  private readonly lessonsSignal = signal<ManagedLesson[]>([]);
  private readonly feedbackSignal = signal<AdminLessonsFeedback | null>(null);
  private readonly loadingSignal = signal(false);
  private readonly activeLessonIdSignal = signal<string | null>(null);
  private readonly generatingSignal = signal(false);
  private lessonsUnsubscribe?: Unsubscribe;

  readonly lessons = this.lessonsSignal.asReadonly();
  readonly feedback = this.feedbackSignal.asReadonly();
  readonly isLoading = this.loadingSignal.asReadonly();
  readonly activeLessonId = this.activeLessonIdSignal.asReadonly();
  readonly isGenerating = this.generatingSignal.asReadonly();
  readonly canManageLessons = computed(
    () => this.authService.isAdmin() && !!this.firebase.firestore && !!this.firebase.functions,
  );

  constructor() {
    effect(() => {
      const currentLearner = this.authService.learner();
      const isAdmin = currentLearner?.role === 'admin';

      this.lessonsUnsubscribe?.();
      this.lessonsUnsubscribe = undefined;
      this.lessonsSignal.set([]);

      if (!isAdmin || !this.firebase.firestore) {
        this.loadingSignal.set(false);
        return;
      }

      this.loadingSignal.set(true);
      this.lessonsUnsubscribe = onSnapshot(
        query(collection(this.firebase.firestore, lessonsCollection), orderBy('updatedAt', 'desc')),
        (snapshot) => {
          this.lessonsSignal.set(
            snapshot.docs
              .map((documentSnapshot) =>
                parseManagedLessonDocument(documentSnapshot.data(), documentSnapshot.id),
              )
              .filter((lesson): lesson is ManagedLesson => lesson !== null),
          );
          this.loadingSignal.set(false);
        },
        () => {
          this.loadingSignal.set(false);
          this.feedbackSignal.set({
            kind: 'error',
            text: 'We could not load the lesson workspace right now. Please try again shortly.',
          });
        },
      );
    });
  }

  async generateLessonDraft(request: LessonGenerationRequest): Promise<GeneratedLessonDraftResult | null> {
    if (!this.firebase.functions) {
      this.feedbackSignal.set({
        kind: 'error',
        text: 'Firebase Functions is not configured for this app yet.',
      });
      return null;
    }

    this.generatingSignal.set(true);
    this.feedbackSignal.set(null);

    try {
      const generateLessonDraft = httpsCallable<LessonGenerationRequest, GenerateLessonDraftResponse>(
        this.firebase.functions,
        generateLessonDraftCallableName,
      );
      const response = await generateLessonDraft(request);
      const draft = toLessonDraft(response.data.lesson);

      if (!draft) {
        throw new Error('The lesson draft response was empty.');
      }

      const validationErrors = [
        ...response.data.validationErrors,
        ...validateLessonDraft(draft),
      ].filter(onlyUnique);

      if (response.data.feedback) {
        this.feedbackSignal.set({
          kind: 'info',
          text: response.data.feedback,
        });
      }

      return {
        draft,
        validationErrors,
        source: response.data.source,
        feedback: response.data.feedback,
      };
    } catch (error) {
      this.feedbackSignal.set({
        kind: 'error',
        text: getCallableErrorMessage(error, 'We could not generate a lesson draft right now.'),
      });
      return null;
    } finally {
      this.generatingSignal.set(false);
    }
  }

  async saveLessonDraft(draft: LessonDraft, publish = false) {
    const validationErrors = validateLessonDraft(draft);

    if (validationErrors.length) {
      this.feedbackSignal.set({
        kind: 'error',
        text: validationErrors[0],
      });
      return {
        ok: false,
        validationErrors,
      };
    }

    if (!this.firebase.functions) {
      this.feedbackSignal.set({
        kind: 'error',
        text: 'Firebase Functions is not configured for this app yet.',
      });
      return {
        ok: false,
        validationErrors: [],
      };
    }

    this.activeLessonIdSignal.set(draft.id);
    this.feedbackSignal.set(null);

    try {
      const upsertLesson = httpsCallable<UpsertLessonRequest, { success: boolean }>(
        this.firebase.functions,
        upsertLessonCallableName,
      );
      await upsertLesson({ lesson: draft, publish });
      this.feedbackSignal.set({
        kind: 'success',
        text: publish ? 'Lesson published.' : 'Lesson draft saved.',
      });

      return {
        ok: true,
        validationErrors: [],
      };
    } catch (error) {
      this.feedbackSignal.set({
        kind: 'error',
        text: getCallableErrorMessage(
          error,
          publish
            ? 'We could not publish the lesson right now.'
            : 'We could not save the lesson draft right now.',
        ),
      });
      return {
        ok: false,
        validationErrors: [],
      };
    } finally {
      this.activeLessonIdSignal.set(null);
    }
  }

  async removeLesson(lessonId: string) {
    if (!this.firebase.functions) {
      this.feedbackSignal.set({
        kind: 'error',
        text: 'Firebase Functions is not configured for this app yet.',
      });
      return false;
    }

    this.activeLessonIdSignal.set(lessonId);
    this.feedbackSignal.set(null);

    try {
      const removeLesson = httpsCallable<{ lessonId: string }, { success: boolean }>(
        this.firebase.functions,
        removeLessonCallableName,
      );
      await removeLesson({ lessonId });
      this.feedbackSignal.set({
        kind: 'success',
        text: 'Lesson removed from the learner catalog.',
      });
      return true;
    } catch (error) {
      this.feedbackSignal.set({
        kind: 'error',
        text: getCallableErrorMessage(error, 'We could not remove the lesson right now.'),
      });
      return false;
    } finally {
      this.activeLessonIdSignal.set(null);
    }
  }
}

interface GenerateLessonDraftResponse {
  lesson: unknown;
  validationErrors: string[];
  source: 'ai' | 'template';
  feedback: string | null;
}

interface UpsertLessonRequest {
  lesson: LessonDraft;
  publish: boolean;
}

function getCallableErrorMessage(error: unknown, fallback: string) {
  return typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
    ? error.message
    : fallback;
}

function onlyUnique(value: string, index: number, values: string[]) {
  return values.indexOf(value) === index;
}
