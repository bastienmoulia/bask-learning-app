import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  parsePersonalizedPracticeLesson,
  PersonalizedPracticeLesson,
  PublishedLesson,
} from '../../features/lesson-player/starter-lesson';
import { FIREBASE_SERVICES } from '../firebase/firebase';
import { AuthService } from './auth';

const practiceUsageStorageKeyPrefix = 'bask.practiceRequests';
const defaultPracticeRequestsPerHour = 3;

export interface PracticeMistake {
  challengeId: string;
  prompt: string;
  learnerAnswer: string;
  correctAnswer: string;
}

export interface PersonalizedPracticeResult {
  lesson: PersonalizedPracticeLesson | null;
  feedback: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class PersonalizedPracticeService {
  private readonly authService = inject(AuthService);
  private readonly firebase = inject(FIREBASE_SERVICES);

  async requestPractice(
    lesson: PublishedLesson,
    mistakes: PracticeMistake[],
    correctAnswers: number,
  ): Promise<PersonalizedPracticeResult> {
    const learnerId = this.authService.learner()?.id ?? null;

    if (!learnerId) {
      return {
        lesson: null,
        feedback: 'Sign in again to request personalized practice.',
      };
    }

    if (!this.firebase.app || !this.firebase.isConfigured) {
      return {
        lesson: null,
        feedback:
          'Personalized practice is not configured yet, but the published lesson is still ready to replay.',
      };
    }

    if (!this.firebase.appCheckEnabled) {
      return {
        lesson: null,
        feedback:
          'Personalized practice is only available when App Check is configured for this app. You can keep learning with the published lesson in the meantime.',
      };
    }

    if (!this.consumeRateLimit(learnerId)) {
      return {
        lesson: null,
        feedback: `You have reached the personalized practice limit for this hour. Please try again later or replay ${lesson.title}.`,
      };
    }

    try {
      const { getAI, getGenerativeModel, GoogleAIBackend } = await import('firebase/ai');
      const ai = getAI(this.firebase.app, { backend: new GoogleAIBackend() });
      const model = getGenerativeModel(ai, {
        model: environment.ai?.practiceModel ?? 'gemini-3.5-flash-lite',
        generationConfig: {
          responseMimeType: 'application/json',
          candidateCount: 1,
          maxOutputTokens: 2048,
          temperature: 0.6,
        },
      });
      const result = await model.generateContent(
        buildPracticePrompt(lesson, mistakes, correctAnswers),
      );
      const practiceLesson = parsePersonalizedPracticeLesson(
        JSON.parse(result.response.text()),
        lesson,
      );

      if (!practiceLesson) {
        return {
          lesson: null,
          feedback:
            'The personalized practice response did not match the supported lesson format, so the published lesson remains available instead.',
        };
      }

      return {
        lesson: practiceLesson,
        feedback: null,
      };
    } catch {
      return {
        lesson: null,
        feedback:
          'We could not generate extra practice right now, so you can continue with the published lesson instead.',
      };
    }
  }

  private consumeRateLimit(learnerId: string) {
    const storageKey = `${practiceUsageStorageKeyPrefix}:${learnerId}`;
    const currentHourAgo = Date.now() - 60 * 60 * 1000;
    const maxRequests =
      environment.ai?.maxPracticeRequestsPerHour ?? defaultPracticeRequestsPerHour;
    const timestamps = loadStoredTimestamps(storageKey).filter(
      (timestamp) => timestamp >= currentHourAgo,
    );

    if (timestamps.length >= maxRequests) {
      localStorage.setItem(storageKey, JSON.stringify(timestamps));
      return false;
    }

    timestamps.push(Date.now());
    localStorage.setItem(storageKey, JSON.stringify(timestamps));
    return true;
  }
}

function buildPracticePrompt(
  lesson: PublishedLesson,
  mistakes: PracticeMistake[],
  correctAnswers: number,
) {
  const mistakeLines = mistakes.length
    ? mistakes
        .map(
          (mistake) =>
            `- Challenge ${mistake.challengeId}: prompt="${mistake.prompt}", learnerAnswer="${mistake.learnerAnswer}", correctAnswer="${mistake.correctAnswer}"`,
        )
        .join('\n')
    : '- No mistakes were recorded. Reinforce the lesson with light review.';

  return [
    'You are generating extra Basque practice for a language learner.',
    'Return only JSON with this shape:',
    '{',
    '  "id": "string",',
    '  "title": "string",',
    '  "description": "string",',
    '  "level": "string",',
    '  "estimatedMinutes": number,',
    '  "demoLabel": "string",',
    '  "version": "string",',
    '  "basedOnLessonId": "string",',
    '  "basedOnLessonVersion": "string",',
    '  "challenges": [',
    '    { "id": "string", "type": "flashcard", "prompt": "string", "basque": "string", "english": "string" },',
    '    { "id": "string", "type": "multiple-choice", "prompt": "string", "question": "string", "options": ["string"], "answer": "string", "explanation": "string" }',
    '  ]',
    '}',
    'Constraints:',
    '- Include 2 to 4 challenges total.',
    '- Use only the supported challenge types shown above.',
    '- Keep options short and ensure the answer exactly matches one option.',
    `- Base the practice on lesson "${lesson.title}" (${lesson.id}, version ${lesson.version}).`,
    `- The learner answered ${correctAnswers} quiz questions correctly in the published lesson.`,
    '- Make the practice safe for beginner learners and focused on the mistakes below.',
    'Learner mistakes:',
    mistakeLines,
  ].join('\n');
}

function loadStoredTimestamps(storageKey: string) {
  const rawValue = localStorage.getItem(storageKey);

  if (!rawValue) {
    return [] as number[];
  }

  try {
    const parsedValue = JSON.parse(rawValue);
    return Array.isArray(parsedValue)
      ? parsedValue.filter((value) => Number.isFinite(value)).map((value) => Number(value))
      : [];
  } catch {
    localStorage.removeItem(storageKey);
    return [] as number[];
  }
}
