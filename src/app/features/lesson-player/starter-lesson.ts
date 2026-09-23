export type LessonChallenge =
  | {
      id: string;
      type: 'flashcard';
      prompt: string;
      basque: string;
      english: string;
    }
  | {
      id: string;
      type: 'multiple-choice';
      prompt: string;
      question: string;
      options: string[];
      answer: string;
      explanation: string;
    };

interface LessonBase {
  id: string;
  title: string;
  description: string;
  level: string;
  estimatedMinutes: number;
  demoLabel: string;
  version: string;
  challenges: LessonChallenge[];
}

export interface PublishedLesson extends LessonBase {
  kind: 'published';
  published: true;
  publishedAt: string;
}

export interface PersonalizedPracticeLesson extends LessonBase {
  kind: 'personalized';
  basedOnLessonId: string;
  basedOnLessonVersion: string;
}

export type PlayableLesson = PublishedLesson | PersonalizedPracticeLesson;

export const starterLesson: PublishedLesson = {
  kind: 'published',
  id: 'starter-basque-greetings',
  title: 'Basque greetings',
  description: 'A tiny demo lesson focused on saying hello, goodbye, and thanks in Basque.',
  level: 'Starter demo',
  estimatedMinutes: 4,
  demoLabel: 'Published fallback content for local/demo mode.',
  version: 'v1',
  published: true,
  publishedAt: '2026-09-23T00:00:00.000Z',
  challenges: [
    {
      id: 'flashcard-kaixo',
      type: 'flashcard',
      prompt: 'Flashcard 1 · Meet your first Basque greeting.',
      basque: 'Kaixo',
      english: 'Hello',
    },
    {
      id: 'flashcard-agur',
      type: 'flashcard',
      prompt: 'Flashcard 2 · A useful goodbye for everyday conversations.',
      basque: 'Agur',
      english: 'Goodbye',
    },
    {
      id: 'quiz-eskerrik-asko',
      type: 'multiple-choice',
      prompt: 'Quick check · Pick the right meaning.',
      question: 'What does “Eskerrik asko” mean?',
      options: ['Please', 'Thank you very much', 'See you tomorrow'],
      answer: 'Thank you very much',
      explanation: '“Eskerrik asko” is a common way to say “thank you very much.”',
    },
    {
      id: 'quiz-kaixo',
      type: 'multiple-choice',
      prompt: 'Quick check · Choose the Basque word.',
      question: 'Which Basque word means “Hello”?',
      options: ['Kaixo', 'Mesedez', 'Ondo ibili'],
      answer: 'Kaixo',
      explanation: '“Kaixo” is the friendly Basque greeting for “hello.”',
    },
  ],
};

export function parsePublishedLessonDocument(
  data: unknown,
  lessonId: string,
): PublishedLesson | null {
  if (!isLessonBase(data) || data.id !== lessonId || data['published'] !== true) {
    return null;
  }

  const publishedAt = typeof data['publishedAt'] === 'string' ? data['publishedAt'] : null;

  if (!publishedAt) {
    return null;
  }

  return {
    kind: 'published',
    id: data.id,
    title: data.title,
    description: data.description,
    level: data.level,
    estimatedMinutes: data.estimatedMinutes,
    demoLabel: data.demoLabel,
    version: data.version,
    published: true,
    publishedAt,
    challenges: data.challenges,
  };
}

export function parsePersonalizedPracticeLesson(
  data: unknown,
  sourceLesson: PublishedLesson,
): PersonalizedPracticeLesson | null {
  if (!isLessonBase(data)) {
    return null;
  }

  const basedOnLessonId =
    typeof data['basedOnLessonId'] === 'string' ? data['basedOnLessonId'] : sourceLesson.id;
  const basedOnLessonVersion =
    typeof data['basedOnLessonVersion'] === 'string'
      ? data['basedOnLessonVersion']
      : sourceLesson.version;

  if (basedOnLessonId !== sourceLesson.id || basedOnLessonVersion !== sourceLesson.version) {
    return null;
  }

  return {
    kind: 'personalized',
    id: data.id,
    title: data.title,
    description: data.description,
    level: data.level,
    estimatedMinutes: data.estimatedMinutes,
    demoLabel: data.demoLabel,
    version: data.version,
    basedOnLessonId,
    basedOnLessonVersion,
    challenges: data.challenges,
  };
}

function isLessonBase(data: unknown): data is LessonBase & Record<string, unknown> {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const lesson = data as Partial<LessonBase> & Record<string, unknown>;
  const estimatedMinutes = lesson.estimatedMinutes;

  return (
    typeof lesson.id === 'string' &&
    lesson.id.length >= 3 &&
    lesson.id.length <= 80 &&
    typeof lesson.title === 'string' &&
    lesson.title.length >= 3 &&
    lesson.title.length <= 120 &&
    typeof lesson.description === 'string' &&
    lesson.description.length >= 10 &&
    lesson.description.length <= 280 &&
    typeof lesson.level === 'string' &&
    lesson.level.length >= 2 &&
    lesson.level.length <= 40 &&
    typeof lesson.demoLabel === 'string' &&
    lesson.demoLabel.length >= 3 &&
    lesson.demoLabel.length <= 160 &&
    typeof lesson.version === 'string' &&
    lesson.version.length >= 1 &&
    lesson.version.length <= 40 &&
    typeof estimatedMinutes === 'number' &&
    Number.isFinite(estimatedMinutes) &&
    estimatedMinutes >= 1 &&
    estimatedMinutes <= 30 &&
    Array.isArray(lesson.challenges) &&
    lesson.challenges.length >= 1 &&
    lesson.challenges.length <= 12 &&
    lesson.challenges.every((challenge) => isLessonChallenge(challenge))
  );
}

function isLessonChallenge(data: unknown): data is LessonChallenge {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const challenge = data as Partial<LessonChallenge>;

  if (
    typeof challenge.id !== 'string' ||
    challenge.id.length < 3 ||
    challenge.id.length > 80 ||
    typeof challenge.prompt !== 'string' ||
    challenge.prompt.length < 3 ||
    challenge.prompt.length > 160
  ) {
    return false;
  }

  if (challenge.type === 'flashcard') {
    return (
      typeof challenge.basque === 'string' &&
      challenge.basque.length >= 1 &&
      challenge.basque.length <= 80 &&
      typeof challenge.english === 'string' &&
      challenge.english.length >= 1 &&
      challenge.english.length <= 120
    );
  }

  if (challenge.type === 'multiple-choice') {
    return (
      typeof challenge.question === 'string' &&
      challenge.question.length >= 3 &&
      challenge.question.length <= 180 &&
      Array.isArray(challenge.options) &&
      challenge.options.length >= 2 &&
      challenge.options.length <= 5 &&
      challenge.options.every((option) => typeof option === 'string' && option.length <= 120) &&
      typeof challenge.answer === 'string' &&
      challenge.options.includes(challenge.answer) &&
      typeof challenge.explanation === 'string' &&
      challenge.explanation.length >= 3 &&
      challenge.explanation.length <= 220
    );
  }

  return false;
}
