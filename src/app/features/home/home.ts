import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth';
import { LearnerProgressService } from '../../core/services/learner-progress';
import { LessonsService } from '../../core/services/lessons';
import { PublishedLesson, starterLesson } from '../lesson-player/starter-lesson';

@Component({
  selector: 'app-home',
  imports: [RouterLink, DatePipe],
  standalone: true,
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class HomeComponent {
  private readonly authService = inject(AuthService);
  private readonly learnerProgressService = inject(LearnerProgressService);
  private readonly lessonsService = inject(LessonsService);

  protected readonly progress = this.learnerProgressService.progress;
  protected readonly syncFeedback = this.learnerProgressService.syncFeedback;
  protected readonly learner = this.authService.learner;
  protected readonly completionRate = this.learnerProgressService.completionRate;
  protected readonly starterLesson = starterLesson;
  protected readonly publishedLessons = signal<PublishedLesson[]>([starterLesson]);
  protected readonly catalogFeedback = signal<string | null>(null);
  protected readonly progressSummary = computed(
    () => this.progress().lessonSummaries[this.starterLesson.id] ?? null,
  );

  constructor() {
    void this.loadPublishedLessons();
  }

  private async loadPublishedLessons() {
    const result = await this.lessonsService.listPublishedLessons();
    this.publishedLessons.set(result.lessons);
    this.catalogFeedback.set(result.feedback);
  }
}
