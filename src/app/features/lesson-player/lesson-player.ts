import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LearnerProgressService } from '../../core/services/learner-progress';
import { LessonChallenge, starterLesson } from './starter-lesson';

@Component({
  selector: 'app-lesson-player',
  imports: [RouterLink],
  standalone: true,
  templateUrl: './lesson-player.html',
  styleUrl: './lesson-player.scss',
})
export class LessonPlayerComponent {
  private readonly learnerProgressService = inject(LearnerProgressService);
  private lessonCompletionRecorded = false;

  readonly lesson = starterLesson;
  readonly currentIndex = signal(0);
  readonly selectedOption = signal<string | null>(null);
  readonly revealAnswer = signal(false);
  readonly correctAnswers = signal(0);
  readonly totalQuizQuestions = this.lesson.challenges.filter(
    (challenge) => challenge.type === 'multiple-choice',
  ).length;
  readonly currentChallenge = computed<LessonChallenge | null>(
    () => this.lesson.challenges[this.currentIndex()] ?? null,
  );
  readonly progressPercent = computed(() =>
    Math.round((this.currentIndex() / this.lesson.challenges.length) * 100),
  );
  readonly isComplete = computed(() => this.currentIndex() >= this.lesson.challenges.length);
  readonly earnedXp = signal(0);
  readonly summaryMessage = computed(() =>
    this.correctAnswers() === this.totalQuizQuestions
      ? 'Perfect run! You nailed the demo lesson.'
      : 'Nice start! Replay anytime to strengthen these first Basque words.',
  );

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
    }
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

  private maybeRecordCompletion() {
    if (!this.isComplete() || this.lessonCompletionRecorded) {
      return;
    }

    this.lessonCompletionRecorded = true;
    this.earnedXp.set(
      this.learnerProgressService.recordLessonCompletion(
        this.lesson.id,
        this.lesson.title,
        this.lesson.challenges.length,
        this.correctAnswers(),
      ),
    );
  }
}
