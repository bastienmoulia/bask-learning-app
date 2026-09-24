import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { FIREBASE_SERVICES } from '../../core/firebase/firebase';
import { AuthService } from '../../core/services/auth';
import { LearnerProgressService } from '../../core/services/learner-progress';
import { LessonsService } from '../../core/services/lessons';
import { PersonalizedPracticeService } from '../../core/services/personalized-practice';
import { LessonPlayerComponent } from './lesson-player';
import { starterLesson } from './starter-lesson';

describe('LessonPlayerComponent', () => {
  let component: LessonPlayerComponent;
  let fixture: ComponentFixture<LessonPlayerComponent>;
  let learnerProgressService: LearnerProgressService;
  const getPublishedLesson = vi.fn();
  const requestPractice = vi.fn();

  beforeEach(async () => {
    localStorage.clear();
    getPublishedLesson.mockReset().mockResolvedValue({
      lesson: starterLesson,
      feedback: null,
      source: 'firestore',
    });
    requestPractice.mockReset().mockResolvedValue({
      lesson: null,
      feedback: null,
    });

    await TestBed.configureTestingModule({
      imports: [LessonPlayerComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            learner: signal({
              id: 'learner-123',
              displayName: 'Learner',
              email: 'learner@example.com',
              role: 'learner',
            }).asReadonly(),
          },
        },
        {
          provide: FIREBASE_SERVICES,
          useValue: {
            app: null,
            appCheck: null,
            auth: null,
            firestore: null,
            functions: null,
            appCheckEnabled: false,
            isConfigured: false,
          },
        },
        {
          provide: LessonsService,
          useValue: {
            getPublishedLesson,
          },
        },
        {
          provide: PersonalizedPracticeService,
          useValue: {
            requestPractice,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LessonPlayerComponent);
    component = fixture.componentInstance;
    learnerProgressService = TestBed.inject(LearnerProgressService);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(getPublishedLesson).toHaveBeenCalledWith(starterLesson.id);
  });

  it('completes the published lesson and records versioned progress', () => {
    component.flipFlashcard();
    component.advanceFlashcard();
    component.flipFlashcard();
    component.advanceFlashcard();
    component.chooseOption('Thank you very much');
    component.moveToNextQuestion();
    component.chooseOption('Kaixo');
    component.moveToNextQuestion();

    fixture.detectChanges();

    expect(component.isComplete()).toBe(true);
    expect(component.correctAnswers()).toBe(2);
    expect(learnerProgressService.progress().lessonsCompleted).toBe(1);
    expect(
      learnerProgressService.progress().lessonSummaries['starter-basque-greetings']?.lessonVersion,
    ).toBe('v1');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Lesson complete');
  });

  it('does not record completion twice after the lesson is already finished', () => {
    component.flipFlashcard();
    component.advanceFlashcard();
    component.flipFlashcard();
    component.advanceFlashcard();
    component.chooseOption('Thank you very much');
    component.moveToNextQuestion();
    component.chooseOption('Kaixo');
    component.moveToNextQuestion();

    component.moveToNextQuestion();
    component.advanceFlashcard();

    expect(component.currentIndex()).toBe(starterLesson.challenges.length);
    expect(learnerProgressService.progress().lessonsCompleted).toBe(1);
    expect(learnerProgressService.progress().totalXp).toBe(15);
  });

  it('switches to validated personalized practice without changing published lesson progress', async () => {
    requestPractice.mockResolvedValueOnce({
      lesson: {
        kind: 'personalized',
        id: 'starter-basque-greetings-practice-1',
        title: 'Basque greetings practice',
        description: 'Extra review for the greetings you missed.',
        level: 'Starter review',
        estimatedMinutes: 3,
        demoLabel: 'Validated AI-generated practice.',
        version: 'practice-v1',
        supportedChallengeTypes: ['multiple-choice'],
        basedOnLessonId: starterLesson.id,
        basedOnLessonVersion: starterLesson.version,
        challenges: starterLesson.challenges.slice(2),
      },
      feedback: null,
    });

    component.flipFlashcard();
    component.advanceFlashcard();
    component.flipFlashcard();
    component.advanceFlashcard();
    component.chooseOption('Please');
    component.moveToNextQuestion();
    component.chooseOption('Kaixo');
    component.moveToNextQuestion();

    await component.requestPersonalizedPractice();
    fixture.detectChanges();

    expect(requestPractice).toHaveBeenCalledTimes(1);
    expect(component.lesson()?.kind).toBe('personalized');
    expect(component.currentIndex()).toBe(0);
    expect(learnerProgressService.progress().lessonsCompleted).toBe(1);
    expect(component.practiceFeedback()).toContain('validated');
  });
});
