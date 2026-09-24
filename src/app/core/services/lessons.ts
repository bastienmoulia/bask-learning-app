import { inject, Injectable } from '@angular/core';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { FIREBASE_SERVICES } from '../firebase/firebase';
import {
  parsePublishedLessonDocument,
  PublishedLesson,
  starterLesson,
} from '../../features/lesson-player/starter-lesson';

const lessonsCollection = 'lessons';
const legacyPublishedLessonsCollection = 'publishedLessons';

export interface PublishedLessonResult {
  lesson: PublishedLesson | null;
  feedback: string | null;
  source: 'firestore' | 'fallback' | 'missing';
}

export interface PublishedLessonCatalogResult {
  lessons: PublishedLesson[];
  feedback: string | null;
  source: 'firestore' | 'fallback';
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

    const primaryResult = await this.getPublishedLessonFromCollection(lessonsCollection, lessonId);

    if (primaryResult.lesson || primaryResult.source === 'missing') {
      return primaryResult;
    }

    return this.getPublishedLessonFromCollection(
      legacyPublishedLessonsCollection,
      lessonId,
      primaryResult.feedback,
    );
  }

  async listPublishedLessons(): Promise<PublishedLessonCatalogResult> {
    if (!this.firebase.isConfigured || !this.firebase.firestore) {
      return {
        lessons: [starterLesson],
        feedback: null,
        source: 'fallback',
      };
    }

    try {
      const snapshot = await getDocs(
        query(
          collection(this.firebase.firestore, lessonsCollection),
          where('published', '==', true),
        ),
      );
      const lessons = snapshot.docs
        .map((documentSnapshot) =>
          parsePublishedLessonDocument(documentSnapshot.data(), documentSnapshot.id),
        )
        .filter((lesson): lesson is PublishedLesson => lesson !== null)
        .sort((left, right) => left.title.localeCompare(right.title));

      return {
        lessons: ensureStarterLesson(lessons),
        feedback: null,
        source: 'firestore',
      };
    } catch {
      return {
        lessons: [starterLesson],
        feedback:
          'We could not refresh the published lesson catalog from Firestore right now. Showing the reviewed starter lesson instead.',
        source: 'fallback',
      };
    }
  }

  private async getPublishedLessonFromCollection(
    collectionName: string,
    lessonId: string,
    fallbackFeedback: string | null = null,
  ): Promise<PublishedLessonResult> {
    try {
      const snapshot = await getDoc(doc(this.firebase.firestore!, collectionName, lessonId));

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

      return this.getFallbackLesson(lessonId, fallbackFeedback);
    } catch {
      return this.getFallbackLesson(
        lessonId,
        fallbackFeedback ??
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

function ensureStarterLesson(lessons: PublishedLesson[]) {
  return lessons.some((lesson) => lesson.id === starterLesson.id)
    ? lessons
    : [starterLesson, ...lessons];
}
