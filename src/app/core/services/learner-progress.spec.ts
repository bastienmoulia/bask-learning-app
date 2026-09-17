import { TestBed } from '@angular/core/testing';
import { LearnerProgressService } from './learner-progress';

describe('LearnerProgressService', () => {
  let service: LearnerProgressService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(LearnerProgressService);
  });

  it('records lesson completion in local demo progress', () => {
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

  it('does not award duplicate XP for replaying the same lesson', () => {
    service.recordLessonCompletion('starter-basque-greetings', 'Basque greetings', 4, 1);
    const replayXp = service.recordLessonCompletion(
      'starter-basque-greetings',
      'Basque greetings',
      4,
      2,
    );

    expect(replayXp).toBe(0);
    expect(service.progress().lessonsCompleted).toBe(1);
    expect(service.progress().totalXp).toBe(15);
    expect(service.progress().lessonSummaries['starter-basque-greetings']?.bestScore).toBe(2);
  });
});
