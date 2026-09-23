import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Firestore } from 'firebase/firestore';
import { vi } from 'vitest';
import { FIREBASE_SERVICES, type FirebaseServices } from '../firebase/firebase';
import { AuthService, LearnerSession } from './auth';
import { LearnerProgressService } from './learner-progress';

const firestoreMocks = vi.hoisted(() => ({
  getFirestore: vi.fn(() => ({}) as Firestore),
  doc: vi.fn((_firestore: Firestore, collectionPath: string, documentId: string) => ({
    collectionPath,
    documentId,
  })),
  getDoc: vi.fn(),
  setDoc: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('firebase/firestore', () => firestoreMocks);

describe('LearnerProgressService', () => {
  let service: LearnerProgressService;
  const learnerSignal = signal<LearnerSession | null>(null);
  const mockFirestore = {} as Firestore;

  function configureProgressService(options?: Partial<FirebaseServices>) {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            learner: learnerSignal.asReadonly(),
          },
        },
        {
          provide: FIREBASE_SERVICES,
          useValue: {
            app: null,
            appCheck: null,
            auth: null,
            firestore: mockFirestore,
            appCheckEnabled: false,
            isConfigured: true,
            ...options,
          } satisfies FirebaseServices,
        },
      ],
    });

    service = TestBed.inject(LearnerProgressService);
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
    learnerSignal.set({
      id: 'learner-a',
      displayName: 'Learner A',
      email: 'learner-a@example.com',
    });
    firestoreMocks.doc.mockClear();
    firestoreMocks.getDoc.mockReset().mockResolvedValue({
      exists: () => false,
    });
    firestoreMocks.setDoc.mockReset().mockResolvedValue(undefined);
    configureProgressService();
  });

  it('records lesson completion in the signed-in learner progress and syncs it', async () => {
    const awardedXp = service.recordLessonCompletion(
      'starter-basque-greetings',
      'Basque greetings',
      'v1',
      4,
      2,
    );

    expect(awardedXp).toBe(15);
    expect(service.progress().lessonsCompleted).toBe(1);
    expect(service.progress().totalXp).toBe(15);
    expect(service.progress().lessonSummaries['starter-basque-greetings']?.bestScore).toBe(2);
    expect(service.completionRate()).toBe(100);

    await vi.waitFor(() => expect(firestoreMocks.setDoc).toHaveBeenCalledTimes(1));
    expect(firestoreMocks.setDoc).toHaveBeenCalledWith(
      {
        collectionPath: 'learnerProgress',
        documentId: 'learner-a',
      },
      expect.objectContaining({
        uid: 'learner-a',
        totalXp: 15,
        lessonsCompleted: 1,
        lessonSummaries: {
          'starter-basque-greetings': expect.objectContaining({
            lessonVersion: 'v1',
          }),
        },
      }),
    );
  });

  it('updates the best score on replay without awarding first-completion xp twice', async () => {
    service.recordLessonCompletion('starter-basque-greetings', 'Basque greetings', 'v1', 4, 1);
    service.recordLessonCompletion('starter-basque-greetings', 'Basque greetings', 'v1', 4, 2);

    await vi.waitFor(() => expect(firestoreMocks.setDoc).toHaveBeenCalledTimes(2));

    expect(service.progress().lessonsCompleted).toBe(1);
    expect(service.progress().totalXp).toBe(15);
    expect(service.progress().lessonSummaries['starter-basque-greetings']?.bestScore).toBe(2);
    expect(service.progress().lessonSummaries['starter-basque-greetings']?.lastPlayedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T/,
    );
  });

  it('loads saved Firestore progress into the dashboard on app restart', async () => {
    learnerSignal.set(null);
    TestBed.flushEffects();

    firestoreMocks.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        uid: 'learner-a',
        updatedAt: '2026-09-23T20:00:00.000Z',
        streakDays: 1,
        totalXp: 15,
        lessonsCompleted: 1,
        currentPathLabel: 'Basque basics',
        lessonSummaries: {
          'starter-basque-greetings': {
            lessonId: 'starter-basque-greetings',
            lessonVersion: 'v1',
            title: 'Basque greetings',
            stepsCompleted: 4,
            totalSteps: 4,
            bestScore: 2,
            lastPlayedAt: '2026-09-23T20:00:00.000Z',
          },
        },
      }),
    });

    learnerSignal.set({
      id: 'learner-a',
      displayName: 'Learner A',
      email: 'learner-a@example.com',
    });
    TestBed.flushEffects();

    await vi.waitFor(() => expect(service.progress().lessonsCompleted).toBe(1));

    expect(service.progress().lessonSummaries['starter-basque-greetings']?.bestScore).toBe(2);
    expect(service.progress().totalXp).toBe(15);
  });

  it('keeps locally saved progress and exposes sync failure when Firestore save fails', async () => {
    firestoreMocks.setDoc.mockImplementationOnce(async () => {
      throw new Error('permission-denied');
    });

    service.recordLessonCompletion('starter-basque-greetings', 'Basque greetings', 'v1', 4, 2);

    expect(service.progress().lessonsCompleted).toBe(1);
    expect(service.progress().totalXp).toBe(15);
    expect(localStorage.getItem('bask.learnerProgress:learner-a')).toContain(
      'starter-basque-greetings',
    );
    await vi.waitFor(() => expect(firestoreMocks.setDoc).toHaveBeenCalledTimes(1));

    await vi.waitFor(() =>
      expect(service.syncFeedback()?.text ?? '').toContain('saved on this device'),
    );
  });

  it('clears the previous learner progress from the visible dashboard on sign-out', async () => {
    service.recordLessonCompletion('starter-basque-greetings', 'Basque greetings', 'v1', 4, 1);
    await vi.waitFor(() => expect(firestoreMocks.setDoc).toHaveBeenCalledTimes(1));

    learnerSignal.set(null);
    TestBed.flushEffects();

    expect(service.progress().lessonsCompleted).toBe(0);
    expect(service.progress().lessonSummaries['starter-basque-greetings']).toBeUndefined();
    expect(service.syncFeedback()).toBeNull();
  });

  it('keeps progress isolated per authenticated learner on the same device', async () => {
    service.recordLessonCompletion('starter-basque-greetings', 'Basque greetings', 'v1', 4, 1);
    await vi.waitFor(() => expect(firestoreMocks.setDoc).toHaveBeenCalledTimes(1));

    learnerSignal.set({
      id: 'learner-b',
      displayName: 'Learner B',
      email: 'learner-b@example.com',
    });
    TestBed.flushEffects();

    expect(service.progress().lessonsCompleted).toBe(0);
    expect(service.progress().lessonSummaries['starter-basque-greetings']).toBeUndefined();

    learnerSignal.set({
      id: 'learner-a',
      displayName: 'Learner A',
      email: 'learner-a@example.com',
    });
    TestBed.flushEffects();

    expect(service.progress().lessonsCompleted).toBe(1);
    expect(service.progress().lessonSummaries['starter-basque-greetings']?.bestScore).toBe(1);
  });
});
