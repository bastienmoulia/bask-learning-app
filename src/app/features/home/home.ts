import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth';
import { LearnerProgressService } from '../../core/services/learner-progress';
import { starterLesson } from '../lesson-player/starter-lesson';

@Component({
  selector: 'app-home',
  imports: [RouterLink, DatePipe],
  standalone: true,
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomeComponent {
  private readonly authService = inject(AuthService);
  private readonly learnerProgressService = inject(LearnerProgressService);

  protected readonly progress = this.learnerProgressService.progress;
  protected readonly syncFeedback = this.learnerProgressService.syncFeedback;
  protected readonly learner = this.authService.learner;
  protected readonly completionRate = this.learnerProgressService.completionRate;
  protected readonly starterLesson = starterLesson;
  protected readonly progressSummary = computed(
    () => this.progress().lessonSummaries[this.starterLesson.id] ?? null,
  );
}
