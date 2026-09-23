import { inject, Injectable } from '@angular/core';
import { doc, getDoc } from 'firebase/firestore';
import { FIREBASE_SERVICES } from '../firebase/firebase';
import {
  parsePublishedLessonDocument,
  PublishedLesson,
  starterLesson,
} from '../../features/lesson-player/starter-lesson';

const publishedLessonsCollection = 'publishedLessons';

export interface PublishedLessonResult {
  lesson: PublishedLesson | null;
  feedback: string | null;
  source: 'firestore' | 'fallback' | 'missing';
}

@Injectable({
  providedIn: 'root',
})
export class LessonsService {
  private readonly firebase = inject(FIREBASE_SERVICES);

  async getPublishedLesson(lessonId: string): Promise<PublishedLessonResult> {
    if (!this.firebase.isConfigured || !this.firebase.firestore) {
      return this.getFallbackLesson(lessonId, null);
    }

    try {
      const snapshot = await getDoc(
        doc(this.firebase.firestore, publishedLessonsCollection, lessonId),
      );

      if (snapshot.exists()) {
        const lesson = parsePublishedLessonDocument(snapshot.data(), lessonId);

        if (lesson) {
          return {
            lesson,
            feedback: null,
            source: 'firestore',
          };
        }

        return this.getFallbackLesson(
          lessonId,
          'We found lesson content in Firestore, but it did not pass validation. Showing the reviewed published fallback instead.',
        );
      }

      return this.getFallbackLesson(lessonId, null);
    } catch {
      return this.getFallbackLesson(
        lessonId,
        'We could not load the published lesson from Firestore right now. Showing the reviewed published fallback instead.',
      );
    }
  }

  private getFallbackLesson(lessonId: string, feedback: string | null): PublishedLessonResult {
    if (lessonId !== starterLesson.id) {
      return {
        lesson: null,
        feedback:
          feedback ??
          'This published lesson is not available on this device yet. Try again after it has been published to Firestore.',
        source: 'missing',
      };
    }

    return {
      lesson: starterLesson,
      feedback,
      source: 'fallback',
    };
  }
}
