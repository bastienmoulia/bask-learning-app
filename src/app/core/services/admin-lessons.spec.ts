import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Firestore } from 'firebase/firestore';
import { Functions } from 'firebase/functions';
import { vi } from 'vitest';
import { FIREBASE_SERVICES, type FirebaseServices } from '../firebase/firebase';
import { AuthService } from './auth';
import { AdminLessonsService } from './admin-lessons';

const firebaseFirestoreMocks = vi.hoisted(() => {
  let lessonsSnapshotCallback:
    | ((snapshot: { docs: { id: string; data: () => unknown }[] }) => void)
    | undefined;

  return {
    getFirestore: vi.fn(() => ({} as Firestore)),
    lessonsSnapshotCallback: () => lessonsSnapshotCallback,
    collection: vi.fn(),
    orderBy: vi.fn((field: string, direction?: string) => ({ field, direction })),
    query: vi.fn((_collectionRef, ...constraints: unknown[]) => ({ constraints })),
    onSnapshot: vi.fn(
      (
        _queryRef,
        onNext: (snapshot: { docs: { id: string; data: () => unknown }[] }) => void,
      ) => {
        lessonsSnapshotCallback = onNext;
        return vi.fn();
      },
    ),
  };
});

const firebaseFunctionsMocks = vi.hoisted(() => {
  const generateCallable = vi.fn().mockResolvedValue({
    data: {
      lesson: {
        id: 'basque-travel-basics',
        title: 'Basque travel basics',
        description: 'Practice a few travel phrases for beginner learners.',
        level: 'Beginner',
        estimatedMinutes: 6,
        demoLabel: 'Generated draft pending review.',
        version: 'v1',
        supportedChallengeTypes: ['flashcard', 'multiple-choice'],
        challenges: [
          {
            id: 'flashcard-kaixo',
            type: 'flashcard',
            prompt: 'Meet the greeting.',
            basque: 'Kaixo',
            english: 'Hello',
          },
        ],
      },
      validationErrors: [],
      source: 'ai',
      feedback: null,
    },
  });
  const upsertCallable = vi.fn().mockResolvedValue({ data: { success: true } });
  const removeCallable = vi.fn().mockResolvedValue({ data: { success: true } });

  return {
    generateCallable,
    upsertCallable,
    removeCallable,
    httpsCallable: vi.fn((_functions: Functions, name: string) => {
      if (name === 'generateLessonDraft') {
        return generateCallable;
      }

      if (name === 'upsertLesson') {
        return upsertCallable;
      }

      return removeCallable;
    }),
  };
});

vi.mock('firebase/firestore', () => firebaseFirestoreMocks);
vi.mock('firebase/functions', () => firebaseFunctionsMocks);

describe('AdminLessonsService', () => {
  let service: AdminLessonsService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    firebaseFirestoreMocks.collection.mockClear();
    firebaseFirestoreMocks.orderBy.mockClear();
    firebaseFirestoreMocks.query.mockClear();
    firebaseFirestoreMocks.onSnapshot.mockClear();
    firebaseFunctionsMocks.generateCallable.mockReset().mockResolvedValue({
      data: {
        lesson: {
          id: 'basque-travel-basics',
          title: 'Basque travel basics',
          description: 'Practice a few travel phrases for beginner learners.',
          level: 'Beginner',
          estimatedMinutes: 6,
          demoLabel: 'Generated draft pending review.',
          version: 'v1',
          supportedChallengeTypes: ['flashcard', 'multiple-choice'],
          challenges: [
            {
              id: 'flashcard-kaixo',
              type: 'flashcard',
              prompt: 'Meet the greeting.',
              basque: 'Kaixo',
              english: 'Hello',
            },
          ],
        },
        validationErrors: [],
        source: 'ai',
        feedback: null,
      },
    });
    firebaseFunctionsMocks.upsertCallable.mockReset().mockResolvedValue({ data: { success: true } });
    firebaseFunctionsMocks.removeCallable.mockReset().mockResolvedValue({ data: { success: true } });
    firebaseFunctionsMocks.httpsCallable.mockClear();

    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            learner: signal({
              id: 'admin-1',
              displayName: 'Admin',
              email: 'admin@example.com',
              role: 'admin',
            }).asReadonly(),
            isAdmin: vi.fn(() => true),
          },
        },
        {
          provide: FIREBASE_SERVICES,
          useValue: {
            app: null,
            appCheck: null,
            auth: null,
            firestore: {} as Firestore,
            functions: {} as Functions,
            appCheckEnabled: false,
            isConfigured: true,
          } satisfies FirebaseServices,
        },
      ],
    });

    service = TestBed.inject(AdminLessonsService);
  });

  it('subscribes to admin lessons and generates validated lesson drafts', async () => {
    await vi.waitFor(() => expect(firebaseFirestoreMocks.onSnapshot).toHaveBeenCalledTimes(1));

    firebaseFirestoreMocks.lessonsSnapshotCallback()?.({
      docs: [
        {
          id: 'starter-basque-greetings',
          data: () => ({
            id: 'starter-basque-greetings',
            title: 'Basque greetings',
            description: 'A tiny demo lesson focused on saying hello, goodbye, and thanks in Basque.',
            level: 'Starter demo',
            estimatedMinutes: 4,
            demoLabel: 'Published fallback content for local/demo mode.',
            version: 'v1',
            supportedChallengeTypes: ['flashcard', 'multiple-choice'],
            challenges: [
              {
                id: 'flashcard-kaixo',
                type: 'flashcard',
                prompt: 'Meet the greeting.',
                basque: 'Kaixo',
                english: 'Hello',
              },
            ],
            published: true,
            createdAt: '2026-09-23T20:00:00.000Z',
            updatedAt: '2026-09-23T20:00:00.000Z',
            publishedAt: '2026-09-23T20:00:00.000Z',
            removedAt: null,
          }),
        },
      ],
    });

    expect(service.lessons()).toHaveLength(1);

    const result = await service.generateLessonDraft({
      topic: 'Travel basics',
      level: 'Beginner',
      learningGoals: 'Say hello and thank someone.',
    });

    expect(firebaseFunctionsMocks.generateCallable).toHaveBeenCalledWith({
      topic: 'Travel basics',
      level: 'Beginner',
      learningGoals: 'Say hello and thank someone.',
    });
    expect(result?.draft.title).toBe('Basque travel basics');
  });

  it('publishes a valid lesson draft and can remove it from the learner catalog', async () => {
    const saveResult = await service.saveLessonDraft(
      {
        id: 'basque-travel-basics',
        title: 'Basque travel basics',
        description: 'Practice a few travel phrases for beginner learners.',
        level: 'Beginner',
        estimatedMinutes: 6,
        demoLabel: 'Generated draft pending review.',
        version: 'v1',
        supportedChallengeTypes: ['flashcard', 'multiple-choice'],
        challenges: [
          {
            id: 'flashcard-kaixo',
            type: 'flashcard',
            prompt: 'Meet the greeting.',
            basque: 'Kaixo',
            english: 'Hello',
          },
        ],
      },
      true,
    );

    expect(saveResult.ok).toBe(true);
    expect(firebaseFunctionsMocks.upsertCallable).toHaveBeenCalledWith({
      lesson: expect.objectContaining({
        id: 'basque-travel-basics',
        version: 'v1',
      }),
      publish: true,
    });

    await service.removeLesson('basque-travel-basics');

    expect(firebaseFunctionsMocks.removeCallable).toHaveBeenCalledWith({
      lessonId: 'basque-travel-basics',
    });
  });
});
