import {
  parsePersonalizedPracticeLesson,
  parsePublishedLessonDocument,
  starterLesson,
} from './starter-lesson';

describe('starter lesson validators', () => {
  it('parses a valid published lesson document', () => {
    const parsedLesson = parsePublishedLessonDocument(
      {
        ...starterLesson,
        kind: undefined,
      },
      starterLesson.id,
    );

    expect(parsedLesson?.kind).toBe('published');
    expect(parsedLesson?.version).toBe('v1');
  });

  it('rejects personalized practice that does not match the source lesson version', () => {
    const parsedLesson = parsePersonalizedPracticeLesson(
      {
        id: 'practice-1',
        title: 'Practice',
        description: 'Quick extra review.',
        level: 'Starter review',
        estimatedMinutes: 3,
        demoLabel: 'AI practice',
        version: 'practice-v1',
        basedOnLessonId: starterLesson.id,
        basedOnLessonVersion: 'v999',
        challenges: starterLesson.challenges.slice(2),
      },
      starterLesson,
    );

    expect(parsedLesson).toBeNull();
  });
});
