import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LearnerProgressService } from '../../core/services/learner-progress';
import { LessonsService } from '../../core/services/lessons';
import {
  PersonalizedPracticeService,
  PracticeMistake,
} from '../../core/services/personalized-practice';
import { PlayableLesson, starterLesson } from './starter-lesson';

@Component({
  selector: 'app-lesson-player',
  imports: [RouterLink],
  standalone: true,
  templateUrl: './lesson-player.html',
  styleUrl: './lesson-player.css',
})
export class LessonPlayerComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly learnerProgressService = inject(LearnerProgressService);
  private readonly lessonsService = inject(LessonsService);
  private readonly personalizedPracticeService = inject(PersonalizedPracticeService);
  private lessonCompletionRecorded = false;

  readonly syncFeedback = this.learnerProgressService.syncFeedback;
  readonly lesson = signal<PlayableLesson | null>(null);
  readonly publishedLesson = signal(starterLesson);
  readonly isLoadingLesson = signal(true);
  readonly loadFeedback = signal<string | null>(null);
  readonly practiceFeedback = signal<string | null>(null);
  readonly isGeneratingPractice = signal(false);
  readonly currentIndex = signal(0);
  readonly selectedOption = signal<string | null>(null);
  readonly revealAnswer = signal(false);
  readonly correctAnswers = signal(0);
  readonly mistakes = signal<PracticeMistake[]>([]);
  readonly currentChallenge = computed(
    () => this.lesson()?.challenges[this.currentIndex()] ?? null,
  );
  readonly totalQuizQuestions = computed(
    () =>
      this.lesson()?.challenges.filter((challenge) => challenge.type === 'multiple-choice')
        .length ?? 0,
  );
  readonly progressPercent = computed(() => {
    const activeLesson = this.lesson();

    if (!activeLesson?.challenges.length) {
      return 0;
    }

    return Math.round((this.currentIndex() / activeLesson.challenges.length) * 100);
  });
  readonly isComplete = computed(() => {
    const activeLesson = this.lesson();
    return activeLesson ? this.currentIndex() >= activeLesson.challenges.length : false;
  });
  readonly earnedXp = signal(0);
  readonly summaryMessage = computed(() => {
    const activeLesson = this.lesson();

    if (activeLesson?.kind === 'personalized') {
      return 'Nice review session! Keep replaying the published lesson or ask for more targeted practice later.';
    }

    return this.correctAnswers() === this.totalQuizQuestions()
      ? 'Perfect run! You nailed the published lesson.'
      : 'Nice start! Replay anytime or request extra practice tailored to the answers you missed.';
  });
  readonly canRequestPractice = computed(() => {
    const activeLesson = this.lesson();
    return this.isComplete() && activeLesson?.kind === 'published' && !this.isGeneratingPractice();
  });

  constructor() {
    void this.loadPublishedLesson(this.route.snapshot.paramMap.get('lessonId') ?? starterLesson.id);
  }

  advanceFlashcard() {
    if (this.isComplete()) {
      return;
    }

    this.revealAnswer.set(false);
    this.currentIndex.update((index) => index + 1);
    this.maybeRecordCompletion();
  }

  flipFlashcard() {
    this.revealAnswer.set(true);
  }

  chooseOption(option: string) {
    const challenge = this.currentChallenge();

    if (this.selectedOption() || challenge?.type !== 'multiple-choice') {
      return;
    }

    this.selectedOption.set(option);

    if (option === challenge.answer) {
      this.correctAnswers.update((count) => count + 1);
      return;
    }

    this.mistakes.update((mistakes) => [
      ...mistakes,
      {
        challengeId: challenge.id,
        prompt: challenge.question,
        learnerAnswer: option,
        correctAnswer: challenge.answer,
      },
    ]);
  }

  moveToNextQuestion() {
    if (this.isComplete()) {
      return;
    }

    this.selectedOption.set(null);
    this.currentIndex.update((index) => index + 1);
    this.maybeRecordCompletion();
  }

  isCorrectOption(option: string) {
    const challenge = this.currentChallenge();

    return challenge?.type === 'multiple-choice' && option === challenge.answer;
  }

  async requestPersonalizedPractice() {
    const activeLesson = this.lesson();

    if (!activeLesson || activeLesson.kind !== 'published') {
      return;
    }

    this.isGeneratingPractice.set(true);
    this.practiceFeedback.set(null);
    const practiceResult = await this.personalizedPracticeService.requestPractice(
      activeLesson,
      this.mistakes(),
      this.correctAnswers(),
    );
    this.isGeneratingPractice.set(false);

    if (!practiceResult.lesson) {
      this.practiceFeedback.set(practiceResult.feedback);
      return;
    }

    this.beginLesson(practiceResult.lesson);
    this.practiceFeedback.set('Extra practice is ready and has been validated before being shown.');
  }

  replayPublishedLesson() {
    this.beginLesson(this.publishedLesson());
    this.practiceFeedback.set(null);
  }

  private async loadPublishedLesson(lessonId: string) {
    this.isLoadingLesson.set(true);
    const publishedLessonResult = await this.lessonsService.getPublishedLesson(lessonId);

    if (!publishedLessonResult.lesson) {
      this.lesson.set(null);
      this.loadFeedback.set(
        publishedLessonResult.feedback ??
          'We could not find the published lesson, so there is nothing to play yet.',
      );
      this.isLoadingLesson.set(false);
      return;
    }

    this.loadFeedback.set(publishedLessonResult.feedback);
    this.beginLesson(publishedLessonResult.lesson);
    this.isLoadingLesson.set(false);
  }

  private beginLesson(lesson: PlayableLesson) {
    if (lesson.kind === 'published') {
      this.publishedLesson.set(lesson);
    }

    this.lessonCompletionRecorded = false;
    this.lesson.set(lesson);
    this.currentIndex.set(0);
    this.selectedOption.set(null);
    this.revealAnswer.set(false);
    this.correctAnswers.set(0);
    this.mistakes.set([]);
    this.earnedXp.set(0);
  }

  private maybeRecordCompletion() {
    const activeLesson = this.lesson();

    if (!this.isComplete() || this.lessonCompletionRecorded || activeLesson?.kind !== 'published') {
      return;
    }

    this.lessonCompletionRecorded = true;
    this.earnedXp.set(
      this.learnerProgressService.recordLessonCompletion(
        activeLesson.id,
        activeLesson.title,
        activeLesson.version,
        activeLesson.challenges.length,
        this.correctAnswers(),
      ),
    );
  }
}
