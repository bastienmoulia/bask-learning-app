import {
  parseManagedLessonDocument,
  parsePersonalizedPracticeLesson,
  parsePublishedLessonDocument,
  starterLesson,
  validateLessonDraft,
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
    expect(parsedLesson?.supportedChallengeTypes).toEqual(['flashcard', 'multiple-choice']);
  });

  it('parses an unpublished managed lesson document for admin editing', () => {
    const parsedLesson = parseManagedLessonDocument(
      {
        ...starterLesson,
        kind: undefined,
        published: false,
        createdAt: '2026-09-23T20:00:00.000Z',
        updatedAt: '2026-09-23T20:00:00.000Z',
        publishedAt: null,
        removedAt: null,
      },
      starterLesson.id,
    );

    expect(parsedLesson?.published).toBe(false);
    expect(parsedLesson?.removedAt).toBeNull();
  });

  it('rejects lesson drafts when a challenge type is not enabled for the lesson', () => {
    const errors = validateLessonDraft({
      id: 'lesson-1',
      title: 'Basque greetings',
      description: 'Practice saying hello and goodbye in Basque.',
      level: 'Beginner',
      estimatedMinutes: 4,
      demoLabel: 'Draft for review',
      version: 'v1',
      supportedChallengeTypes: ['flashcard'],
      challenges: starterLesson.challenges,
    });

    expect(errors).toContain('Challenge 3: uses a challenge type that is not enabled for the lesson.');
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
        supportedChallengeTypes: ['multiple-choice'],
        basedOnLessonId: starterLesson.id,
        basedOnLessonVersion: 'v999',
        challenges: starterLesson.challenges.slice(2),
      },
      starterLesson,
    );

    expect(parsedLesson).toBeNull();
  });
});
