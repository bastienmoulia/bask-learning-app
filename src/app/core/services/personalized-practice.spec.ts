import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { starterLesson } from '../../features/lesson-player/starter-lesson';
import { FIREBASE_SERVICES, type FirebaseServices } from '../firebase/firebase';
import { AuthService, type LearnerSession } from './auth';
import { PersonalizedPracticeService } from './personalized-practice';

const aiMocks = vi.hoisted(() => {
  const response = {
    text: vi.fn(),
  };
  const generateContent = vi.fn(async () => ({
    response,
  }));

  return {
    GoogleAIBackend: class {},
    getAI: vi.fn(() => ({ kind: 'ai' })),
    getGenerativeModel: vi.fn(() => ({
      generateContent,
    })),
    generateContent,
    response,
  };
});

vi.mock('firebase/ai', () => aiMocks);

describe('PersonalizedPracticeService', () => {
  const learnerSignal = signal<LearnerSession | null>({
    id: 'learner-a',
    displayName: 'Learner A',
    email: 'learner-a@example.com',
  });

  function createService(options?: Partial<FirebaseServices>) {
    TestBed.resetTestingModule();
    localStorage.clear();
    environment.ai = {
      practiceModel: 'gemini-3.5-flash-lite',
      maxPracticeRequestsPerHour: 3,
    };
    learnerSignal.set({
      id: 'learner-a',
      displayName: 'Learner A',
      email: 'learner-a@example.com',
    });
    aiMocks.getAI.mockClear();
    aiMocks.getGenerativeModel.mockClear();
    aiMocks.generateContent.mockClear();
    aiMocks.response.text.mockReset().mockReturnValue(
      JSON.stringify({
        id: 'starter-basque-greetings-practice-1',
        title: 'Basque greetings practice',
        description: 'Extra review for the greetings you missed.',
        level: 'Starter review',
        estimatedMinutes: 3,
        demoLabel: 'Validated AI-generated practice.',
        version: 'practice-v1',
        basedOnLessonId: starterLesson.id,
        basedOnLessonVersion: starterLesson.version,
        challenges: starterLesson.challenges.slice(2),
      }),
    );

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
            app: { name: 'app' } as FirebaseServices['app'],
            appCheck: null,
            auth: null,
            firestore: null,
            appCheckEnabled: true,
            isConfigured: true,
            ...options,
          } satisfies FirebaseServices,
        },
      ],
    });

    return TestBed.inject(PersonalizedPracticeService);
  }

  it('blocks personalized practice when App Check is not enabled', async () => {
    const service = createService({
      appCheckEnabled: false,
    });

    const result = await service.requestPractice(starterLesson, [], 2);

    expect(result.lesson).toBeNull();
    expect(result.feedback).toContain('App Check');
  });

  it('returns validated personalized practice from AI output', async () => {
    const service = createService();

    const result = await service.requestPractice(starterLesson, [], 2);

    expect(aiMocks.getAI).toHaveBeenCalledTimes(1);
    expect(aiMocks.getGenerativeModel).toHaveBeenCalledTimes(1);
    expect(aiMocks.generateContent).toHaveBeenCalledTimes(1);
    expect(result.lesson?.kind).toBe('personalized');
    expect(result.lesson?.basedOnLessonVersion).toBe('v1');
  });

  it('enforces the per-hour practice request limit', async () => {
    const service = createService();
    environment.ai = {
      practiceModel: 'gemini-3.5-flash-lite',
      maxPracticeRequestsPerHour: 1,
    };

    const firstResult = await service.requestPractice(starterLesson, [], 2);
    const secondResult = await service.requestPractice(starterLesson, [], 2);

    expect(firstResult.lesson?.kind).toBe('personalized');
    expect(secondResult.lesson).toBeNull();
    expect(secondResult.feedback).toContain('limit');
  });
});
