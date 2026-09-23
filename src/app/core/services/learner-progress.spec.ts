import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService, LearnerSession } from './auth';
import { LearnerProgressService } from './learner-progress';

describe('LearnerProgressService', () => {
  let service: LearnerProgressService;
  const learnerSignal = signal<LearnerSession | null>(null);

  beforeEach(() => {
    localStorage.clear();
    learnerSignal.set({
      id: 'learner-a',
      displayName: 'Learner A',
      email: 'learner-a@example.com',
    });

    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            learner: learnerSignal.asReadonly(),
          },
        },
      ],
    });
    service = TestBed.inject(LearnerProgressService);
  });

  it('records lesson completion in the signed-in learner progress', () => {
    const awardedXp = service.recordLessonCompletion(
      'starter-basque-greetings',
      'Basque greetings',
      4,
      2,
    );

    expect(awardedXp).toBe(15);
    expect(service.progress().lessonsCompleted).toBe(1);
    expect(service.progress().totalXp).toBe(15);
    expect(service.progress().lessonSummaries['starter-basque-greetings']?.bestScore).toBe(2);
    expect(service.completionRate()).toBe(100);
  });

  it('keeps progress isolated per authenticated learner on the same device', async () => {
    service.recordLessonCompletion('starter-basque-greetings', 'Basque greetings', 4, 1);

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
