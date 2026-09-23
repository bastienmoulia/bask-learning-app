export const supportedLessonChallengeTypes = ['flashcard', 'multiple-choice'] as const;
export type LessonChallengeType = (typeof supportedLessonChallengeTypes)[number];

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
  supportedChallengeTypes: LessonChallengeType[];
  challenges: LessonChallenge[];
}

export type LessonDraft = LessonBase;

export interface PublishedLesson extends LessonBase {
  kind: 'published';
  published: true;
  publishedAt: string;
}

export interface ManagedLesson extends LessonBase {
  published: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  removedAt: string | null;
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
  supportedChallengeTypes: [...supportedLessonChallengeTypes],
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

export function createEmptyLessonDraft(seed: Partial<LessonDraft> = {}): LessonDraft {
  const normalized = toLessonDraft(seed);

  return normalized ?? {
    id: '',
    title: '',
    description: '',
    level: '',
    estimatedMinutes: 5,
    demoLabel: 'Reviewed draft pending publication.',
    version: 'v1',
    supportedChallengeTypes: [...supportedLessonChallengeTypes],
    challenges: [createEmptyFlashcardChallenge()],
  };
}

export function createEmptyFlashcardChallenge(index = 1): LessonChallenge {
  return {
    id: `flashcard-${index}`,
    type: 'flashcard',
    prompt: `Flashcard ${index}`,
    basque: '',
    english: '',
  };
}

export function createEmptyMultipleChoiceChallenge(index = 1): LessonChallenge {
  return {
    id: `quiz-${index}`,
    type: 'multiple-choice',
    prompt: `Quick check ${index}`,
    question: '',
    options: ['', ''],
    answer: '',
    explanation: '',
  };
}

export function toLessonDraft(data: unknown): LessonDraft | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const lesson = data as Record<string, unknown>;
  const supportedTypes = normalizeSupportedChallengeTypes(lesson['supportedChallengeTypes']);
  const challenges = normalizeLessonChallenges(lesson['challenges']);

  return {
    id: typeof lesson['id'] === 'string' ? lesson['id'] : '',
    title: typeof lesson['title'] === 'string' ? lesson['title'] : '',
    description: typeof lesson['description'] === 'string' ? lesson['description'] : '',
    level: typeof lesson['level'] === 'string' ? lesson['level'] : '',
    estimatedMinutes:
      typeof lesson['estimatedMinutes'] === 'number' && Number.isFinite(lesson['estimatedMinutes'])
        ? lesson['estimatedMinutes']
        : 5,
    demoLabel:
      typeof lesson['demoLabel'] === 'string'
        ? lesson['demoLabel']
        : 'Reviewed draft pending publication.',
    version: typeof lesson['version'] === 'string' ? lesson['version'] : 'v1',
    supportedChallengeTypes: supportedTypes,
    challenges: challenges.length ? challenges : [createEmptyFlashcardChallenge()],
  };
}

export function validateLessonDraft(draft: LessonDraft) {
  return validateLessonData(draft);
}

export function parseManagedLessonDocument(data: unknown, lessonId: string): ManagedLesson | null {
  const lesson = parseLessonBase(data);

  if (!lesson || lesson.id !== lessonId || !data || typeof data !== 'object') {
    return null;
  }

  const lessonRecord = data as Record<string, unknown>;
  const createdAt = typeof lessonRecord['createdAt'] === 'string' ? lessonRecord['createdAt'] : null;
  const updatedAt = typeof lessonRecord['updatedAt'] === 'string' ? lessonRecord['updatedAt'] : null;
  const published = lessonRecord['published'];
  const publishedAt = lessonRecord['publishedAt'];
  const removedAt = lessonRecord['removedAt'];

  if (
    typeof createdAt !== 'string' ||
    typeof updatedAt !== 'string' ||
    typeof published !== 'boolean' ||
    !isNullableIsoDateString(publishedAt) ||
    !isNullableIsoDateString(removedAt)
  ) {
    return null;
  }

  return {
    ...lesson,
    createdAt,
    updatedAt,
    published,
    publishedAt,
    removedAt,
  };
}

export function parsePublishedLessonDocument(
  data: unknown,
  lessonId: string,
): PublishedLesson | null {
  const lesson = parseLessonBase(data);

  if (!lesson || lesson.id !== lessonId || !data || typeof data !== 'object') {
    return null;
  }

  const lessonRecord = data as Record<string, unknown>;

  if (lessonRecord['published'] !== true) {
    return null;
  }

  const publishedAt = typeof lessonRecord['publishedAt'] === 'string' ? lessonRecord['publishedAt'] : null;

  if (!publishedAt) {
    return null;
  }

  return {
    kind: 'published',
    ...lesson,
    published: true,
    publishedAt,
  };
}

export function parsePersonalizedPracticeLesson(
  data: unknown,
  sourceLesson: PublishedLesson,
): PersonalizedPracticeLesson | null {
  const lesson = parseLessonBase(data);

  if (!lesson || !data || typeof data !== 'object') {
    return null;
  }

  const lessonRecord = data as Record<string, unknown>;
  const basedOnLessonId =
    typeof lessonRecord['basedOnLessonId'] === 'string' ? lessonRecord['basedOnLessonId'] : sourceLesson.id;
  const basedOnLessonVersion =
    typeof lessonRecord['basedOnLessonVersion'] === 'string'
      ? lessonRecord['basedOnLessonVersion']
      : sourceLesson.version;

  if (basedOnLessonId !== sourceLesson.id || basedOnLessonVersion !== sourceLesson.version) {
    return null;
  }

  return {
    kind: 'personalized',
    ...lesson,
    basedOnLessonId,
    basedOnLessonVersion,
  };
}

function parseLessonBase(data: unknown): LessonDraft | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const lesson = data as LessonDraft & Record<string, unknown>;

  if (validateLessonData(lesson).length > 0) {
    return null;
  }

  return {
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
}

function validateLessonData(data: LessonDraft) {
  const errors: string[] = [];

  if (!lessonIdPattern.test(data.id)) {
    errors.push('Lesson ids must be 3 to 80 characters and use lowercase letters, numbers, or hyphens.');
  }

  if (!isStringLength(data.title, 3, 120)) {
    errors.push('Lesson titles must be between 3 and 120 characters.');
  }

  if (!isStringLength(data.description, 10, 280)) {
    errors.push('Descriptions must be between 10 and 280 characters.');
  }

  if (!isStringLength(data.level, 2, 40)) {
    errors.push('Levels must be between 2 and 40 characters.');
  }

  if (!isStringLength(data.demoLabel, 3, 160)) {
    errors.push('Admin notes must be between 3 and 160 characters.');
  }

  if (!isStringLength(data.version, 1, 40)) {
    errors.push('Versions must be between 1 and 40 characters.');
  }

  if (
    typeof data.estimatedMinutes !== 'number' ||
    !Number.isFinite(data.estimatedMinutes) ||
    data.estimatedMinutes < 1 ||
    data.estimatedMinutes > 30
  ) {
    errors.push('Estimated time must be between 1 and 30 minutes.');
  }

  const configuredSupportedTypes = Array.isArray(data.supportedChallengeTypes)
    ? data.supportedChallengeTypes
    : [];
  const supportedTypes = normalizeSupportedChallengeTypes(configuredSupportedTypes);

  if (
    supportedTypes.length !== configuredSupportedTypes.length ||
    supportedTypes.length < 1 ||
    supportedTypes.length > supportedLessonChallengeTypes.length
  ) {
    errors.push('Supported challenge types must contain unique supported values.');
  }

  if (!Array.isArray(data.challenges) || data.challenges.length < 1 || data.challenges.length > 12) {
    errors.push('Lessons must include between 1 and 12 challenges.');
  } else {
    data.challenges.forEach((challenge, index) => {
      const challengeErrors = validateLessonChallenge(challenge, supportedTypes);
      challengeErrors.forEach((error) => {
        errors.push(`Challenge ${index + 1}: ${error}`);
      });
    });
  }

  return errors;
}

function validateLessonChallenge(
  challenge: LessonChallenge,
  supportedTypes: LessonChallengeType[],
) {
  const errors: string[] = [];

  if (!lessonIdPattern.test(challenge.id)) {
    errors.push('ids must be 3 to 80 characters and use lowercase letters, numbers, or hyphens.');
  }

  if (!supportedTypes.includes(challenge.type)) {
    errors.push('uses a challenge type that is not enabled for the lesson.');
  }

  if (!isStringLength(challenge.prompt, 3, 160)) {
    errors.push('prompts must be between 3 and 160 characters.');
  }

  if (challenge.type === 'flashcard') {
    if (!isStringLength(challenge.basque, 1, 80)) {
      errors.push('Basque flashcard text must be between 1 and 80 characters.');
    }

    if (!isStringLength(challenge.english, 1, 120)) {
      errors.push('English flashcard text must be between 1 and 120 characters.');
    }

    return errors;
  }

  if (!isStringLength(challenge.question, 3, 180)) {
    errors.push('questions must be between 3 and 180 characters.');
  }

  if (!Array.isArray(challenge.options) || challenge.options.length < 2 || challenge.options.length > 5) {
    errors.push('options must contain between 2 and 5 choices.');
  } else if (
    challenge.options.some((option) => !isStringLength(option, 1, 120)) ||
    !challenge.options.includes(challenge.answer)
  ) {
    errors.push('options must stay within 120 characters and include the selected answer.');
  }

  if (!isStringLength(challenge.explanation, 3, 220)) {
    errors.push('explanations must be between 3 and 220 characters.');
  }

  return errors;
}

function normalizeSupportedChallengeTypes(value: unknown) {
  if (!Array.isArray(value)) {
    return [...supportedLessonChallengeTypes];
  }

  return [...new Set(value.filter(isLessonChallengeType))];
}

function normalizeLessonChallenges(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as LessonChallenge[];
  }

  return value
    .map((challenge, index) => normalizeLessonChallenge(challenge, index))
    .filter((challenge): challenge is LessonChallenge => challenge !== null);
}

function normalizeLessonChallenge(data: unknown, index: number): LessonChallenge | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const challenge = data as Record<string, unknown>;
  const type = isLessonChallengeType(challenge['type']) ? challenge['type'] : 'flashcard';
  const id = typeof challenge['id'] === 'string' ? challenge['id'] : `${type}-${index + 1}`;
  const prompt = typeof challenge['prompt'] === 'string' ? challenge['prompt'] : '';

  if (type === 'flashcard') {
    return {
      id,
      type,
      prompt,
      basque: typeof challenge['basque'] === 'string' ? challenge['basque'] : '',
      english: typeof challenge['english'] === 'string' ? challenge['english'] : '',
    };
  }

  const options = Array.isArray(challenge['options'])
    ? challenge['options'].filter((option): option is string => typeof option === 'string').slice(0, 5)
    : ['', ''];

  return {
    id,
    type,
    prompt,
    question: typeof challenge['question'] === 'string' ? challenge['question'] : '',
    options: options.length >= 2 ? options : ['', ''],
    answer: typeof challenge['answer'] === 'string' ? challenge['answer'] : '',
    explanation: typeof challenge['explanation'] === 'string' ? challenge['explanation'] : '',
  };
}

function cloneChallenge(challenge: LessonChallenge): LessonChallenge {
  return challenge.type === 'flashcard'
    ? { ...challenge }
    : {
        ...challenge,
        options: [...challenge.options],
      };
}

function isLessonChallengeType(value: unknown): value is LessonChallengeType {
  return value === 'flashcard' || value === 'multiple-choice';
}

function isStringLength(value: unknown, min: number, max: number) {
  return typeof value === 'string' && value.length >= min && value.length <= max;
}

function isNullableIsoDateString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

const lessonIdPattern = /^[a-z0-9-]{3,80}$/;
