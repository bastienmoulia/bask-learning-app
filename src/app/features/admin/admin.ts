import { DatePipe, LowerCasePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AdminLessonsService,
  type GeneratedLessonDraftResult,
  type LessonGenerationRequest,
} from '../../core/services/admin-lessons';
import { AdminUsersService } from '../../core/services/admin-users';
import { AuthService } from '../../core/services/auth';
import { UserProfileDocument } from '../../core/services/user-profiles';
import {
  createEmptyFlashcardChallenge,
  createEmptyLessonDraft,
  createEmptyMultipleChoiceChallenge,
  LessonChallenge,
  LessonDraft,
  ManagedLesson,
  supportedLessonChallengeTypes,
  validateLessonDraft,
} from '../lesson-player/starter-lesson';

@Component({
  selector: 'app-admin',
  imports: [DatePipe, FormsModule, LowerCasePipe],
  standalone: true,
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class AdminComponent {
  private readonly authService = inject(AuthService);
  private readonly adminUsersService = inject(AdminUsersService);
  private readonly adminLessonsService = inject(AdminLessonsService);

  protected readonly currentLearner = this.authService.learner;
  protected readonly users = this.adminUsersService.users;
  protected readonly feedback = this.adminUsersService.feedback;
  protected readonly isLoading = this.adminUsersService.isLoading;
  protected readonly activeUserId = this.adminUsersService.activeUserId;
  protected readonly lessons = this.adminLessonsService.lessons;
  protected readonly lessonFeedback = this.adminLessonsService.feedback;
  protected readonly isLessonsLoading = this.adminLessonsService.isLoading;
  protected readonly activeLessonId = this.adminLessonsService.activeLessonId;
  protected readonly isGeneratingLesson = this.adminLessonsService.isGenerating;
  protected readonly supportedChallengeTypes = [...supportedLessonChallengeTypes];

  protected draft: LessonDraft = createEmptyLessonDraft();
  protected draftValidationErrors: string[] = [];
  protected generationRequest: LessonGenerationRequest = {
    topic: '',
    level: 'Beginner',
    learningGoals: '',
  };

  protected async promote(user: UserProfileDocument) {
    await this.adminUsersService.setUserRole(user.uid, 'admin');
  }

  protected async revoke(user: UserProfileDocument) {
    await this.adminUsersService.setUserRole(user.uid, 'learner');
  }

  protected isCurrentUser(user: UserProfileDocument) {
    return this.currentLearner()?.id === user.uid;
  }

  protected startNewLesson() {
    this.draft = createEmptyLessonDraft();
    this.draftValidationErrors = [];
  }

  protected editLesson(lesson: ManagedLesson) {
    this.draft = {
      id: lesson.id,
      title: lesson.title,
      description: lesson.description,
      level: lesson.level,
      estimatedMinutes: lesson.estimatedMinutes,
      demoLabel: lesson.demoLabel,
      version: lesson.version,
      supportedChallengeTypes: [...lesson.supportedChallengeTypes],
      challenges: lesson.challenges.map((challenge) => cloneChallenge(challenge)),
    };
    this.draftValidationErrors = [];
  }

  protected lessonStatus(lesson: ManagedLesson) {
    if (lesson.removedAt) {
      return 'Removed';
    }

    return lesson.published ? 'Published' : 'Draft';
  }

  protected isEditingLesson(lesson: ManagedLesson) {
    return this.draft.id === lesson.id;
  }

  protected ensureLessonIdFromTitle() {
    if (this.draft.id.trim() || !this.draft.title.trim()) {
      return;
    }

    this.draft.id = slugifyLessonId(this.draft.title);
  }

  protected toggleSupportedChallengeType(type: (typeof supportedLessonChallengeTypes)[number]) {
    if (this.draft.supportedChallengeTypes.includes(type)) {
      if (this.draft.supportedChallengeTypes.length > 1) {
        this.draft.supportedChallengeTypes = this.draft.supportedChallengeTypes.filter(
          (supportedType) => supportedType !== type,
        );
      }

      this.filterChallengesToSupportedTypes();
      return;
    }

    this.draft.supportedChallengeTypes = [...this.draft.supportedChallengeTypes, type];
  }

  protected addFlashcardChallenge() {
    this.draft.challenges = [
      ...this.draft.challenges,
      createEmptyFlashcardChallenge(this.draft.challenges.length + 1),
    ];
  }

  protected addMultipleChoiceChallenge() {
    this.draft.challenges = [
      ...this.draft.challenges,
      createEmptyMultipleChoiceChallenge(this.draft.challenges.length + 1),
    ];
  }

  protected removeChallenge(index: number) {
    this.draft.challenges = this.draft.challenges.filter((_, challengeIndex) => challengeIndex !== index);
  }

  protected addOption(challenge: LessonChallenge) {
    if (challenge.type !== 'multiple-choice' || challenge.options.length >= 5) {
      return;
    }

    challenge.options = [...challenge.options, ''];
  }

  protected removeOption(challenge: LessonChallenge, optionIndex: number) {
    if (challenge.type !== 'multiple-choice' || challenge.options.length <= 2) {
      return;
    }

    const removedOption = challenge.options[optionIndex];
    challenge.options = challenge.options.filter((_, index) => index !== optionIndex);

    if (challenge.answer === removedOption) {
      challenge.answer = '';
    }
  }

  protected async generateDraft() {
    const result = await this.adminLessonsService.generateLessonDraft(this.generationRequest);

    if (!result) {
      return;
    }

    this.applyGeneratedDraft(result);
  }

  protected async saveDraft() {
    this.draftValidationErrors = validateLessonDraft(this.draft);

    if (this.draftValidationErrors.length) {
      return;
    }

    await this.adminLessonsService.saveLessonDraft(this.draft, false);
  }

  protected async publishDraft() {
    this.draftValidationErrors = validateLessonDraft(this.draft);

    if (this.draftValidationErrors.length) {
      return;
    }

    await this.adminLessonsService.saveLessonDraft(this.draft, true);
  }

  protected async removeLesson(lesson: ManagedLesson) {
    if (!window.confirm(`Remove “${lesson.title}” from the learner catalog?`)) {
      return;
    }

    await this.adminLessonsService.removeLesson(lesson.id);
  }

  private applyGeneratedDraft(result: GeneratedLessonDraftResult) {
    this.draft = result.draft;
    this.draftValidationErrors = result.validationErrors;
  }

  private filterChallengesToSupportedTypes() {
    this.draft.challenges = this.draft.challenges.filter((challenge) =>
      this.draft.supportedChallengeTypes.includes(challenge.type),
    );

    if (!this.draft.challenges.length) {
      this.draft.challenges = this.draft.supportedChallengeTypes.includes('flashcard')
        ? [createEmptyFlashcardChallenge()]
        : [createEmptyMultipleChoiceChallenge()];
    }
  }
}

function cloneChallenge(challenge: LessonChallenge): LessonChallenge {
  return challenge.type === 'flashcard'
    ? { ...challenge }
    : {
        ...challenge,
        options: [...challenge.options],
      };
}

function slugifyLessonId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
