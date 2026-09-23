import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/services/auth';
import { LearnerProgressService } from '../../core/services/learner-progress';
import { LessonPlayerComponent } from './lesson-player';

describe('LessonPlayerComponent', () => {
  let component: LessonPlayerComponent;
  let fixture: ComponentFixture<LessonPlayerComponent>;
  let learnerProgressService: LearnerProgressService;

  beforeEach(async () => {
    localStorage.clear();
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
            }).asReadonly(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LessonPlayerComponent);
    component = fixture.componentInstance;
    learnerProgressService = TestBed.inject(LearnerProgressService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('completes the starter lesson and records progress', () => {
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

    expect(component.currentIndex()).toBe(component.lesson.challenges.length);
    expect(learnerProgressService.progress().lessonsCompleted).toBe(1);
    expect(learnerProgressService.progress().totalXp).toBe(15);
  });
});
