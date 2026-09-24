const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');

const usersCollection = 'users';
const lessonsCollection = 'lessons';
const adminRole = 'admin';
const learnerRole = 'learner';
const supportedChallengeTypes = ['flashcard', 'multiple-choice'];
const lessonIdPattern = /^[a-z0-9-]{3,80}$/;
const defaultLessonDraftModel = process.env.LESSON_DRAFT_MODEL || 'gemini-3.5-flash-lite';

admin.initializeApp();
setGlobalOptions({ maxInstances: 10 });

function createUserDocRef(userId) {
  return admin.firestore().collection(usersCollection).doc(userId);
}

function createLessonDocRef(lessonId) {
  return admin.firestore().collection(lessonsCollection).doc(lessonId);
}

async function assertAdmin(callerUid, transaction) {
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'You must be signed in to manage lessons.');
  }

  const callerRef = createUserDocRef(callerUid);
  const callerSnapshot = transaction
    ? await transaction.get(callerRef)
    : await callerRef.get();

  if (!callerSnapshot.exists || callerSnapshot.data()?.role !== adminRole) {
    throw new HttpsError('permission-denied', 'Only administrators can manage lessons.');
  }
}

exports.setUserRole = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  const targetUserId = request.data?.targetUserId;
  const nextRole = request.data?.role;

  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'You must be signed in to manage administrator access.');
  }

  if (targetUserId === callerUid) {
    throw new HttpsError(
      'failed-precondition',
      'Administrators cannot change their own role through the app.',
    );
  }

  if (nextRole !== adminRole && nextRole !== learnerRole) {
    throw new HttpsError('invalid-argument', 'The requested role is not supported.');
  }

  await admin.firestore().runTransaction(async (transaction) => {
    const callerRef = createUserDocRef(callerUid);
    const targetRef = createUserDocRef(targetUserId);
    const callerSnapshot = await transaction.get(callerRef);
    const targetSnapshot = await transaction.get(targetRef);

    if (!callerSnapshot.exists || callerSnapshot.data()?.role !== adminRole) {
      throw new HttpsError('permission-denied', 'Only administrators can manage administrator access.');
    }

    if (!targetSnapshot.exists) {
      throw new HttpsError('not-found', 'The selected user profile does not exist yet.');
    }

    const currentRole = targetSnapshot.data()?.role;

    if (currentRole === nextRole) {
      return;
    }

    if (currentRole === adminRole && nextRole === learnerRole) {
      const currentAdmins = await transaction.get(
        admin.firestore().collection(usersCollection).where('role', '==', adminRole).limit(2),
      );

      if (currentAdmins.size <= 1) {
        throw new HttpsError(
          'failed-precondition',
          'You cannot remove administrator access from the last remaining admin.',
        );
      }
    }

    transaction.update(targetRef, {
      role: nextRole,
      updatedAt: new Date().toISOString(),
    });
  });

  return {
    success: true,
  };
});

exports.generateLessonDraft = onCall(async (request) => {
  await assertAdmin(request.auth?.uid);
  const generationInput = parseLessonGenerationInput(request.data);
  let lessonDraft;
  let source = 'ai';
  let feedback = null;

  try {
    lessonDraft = await generateLessonDraftWithGemini(generationInput);
  } catch (error) {
    if (process.env.GEMINI_API_KEY) {
      throw new HttpsError(
        'unavailable',
        'We could not generate a lesson draft right now. Your current lesson edits are still available.',
      );
    }

    lessonDraft = buildFallbackLessonDraft(generationInput);
    source = 'template';
    feedback =
      'AI lesson generation is not configured in this environment yet, so a structured starter draft was prepared for review instead.';
  }

  const validationErrors = uniqueStrings(validateLessonDraft(lessonDraft));

  return {
    lesson: lessonDraft,
    validationErrors,
    source,
    feedback,
  };
});

exports.upsertLesson = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  const lesson = request.data?.lesson;
  const publish = request.data?.publish === true;
  const validationErrors = validateLessonDraft(lesson);

  if (validationErrors.length) {
    throw new HttpsError('invalid-argument', validationErrors[0]);
  }

  await admin.firestore().runTransaction(async (transaction) => {
    await assertAdmin(callerUid, transaction);

    const lessonRef = createLessonDocRef(lesson.id);
    const lessonSnapshot = await transaction.get(lessonRef);
    const existingLesson = lessonSnapshot.exists ? lessonSnapshot.data() : null;
    const now = new Date().toISOString();

    transaction.set(lessonRef, {
      ...lesson,
      published: publish,
      createdAt: existingLesson?.createdAt ?? now,
      updatedAt: now,
      publishedAt: publish ? now : existingLesson?.publishedAt ?? null,
      removedAt: publish ? null : existingLesson?.removedAt ?? null,
    });
  });

  return {
    success: true,
  };
});

exports.removeLesson = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  const lessonId = request.data?.lessonId;

  if (typeof lessonId !== 'string' || !lessonIdPattern.test(lessonId)) {
    throw new HttpsError('invalid-argument', 'Select a valid lesson before removing it.');
  }

  await admin.firestore().runTransaction(async (transaction) => {
    await assertAdmin(callerUid, transaction);

    const lessonRef = createLessonDocRef(lessonId);
    const lessonSnapshot = await transaction.get(lessonRef);

    if (!lessonSnapshot.exists) {
      throw new HttpsError('not-found', 'The lesson could not be found.');
    }

    transaction.update(lessonRef, {
      published: false,
      removedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  return {
    success: true,
  };
});

function parseLessonGenerationInput(data) {
  const topic = typeof data?.topic === 'string' ? data.topic.trim() : '';
  const level = typeof data?.level === 'string' ? data.level.trim() : '';
  const learningGoals = typeof data?.learningGoals === 'string' ? data.learningGoals.trim() : '';

  if (topic.length < 3 || topic.length > 80) {
    throw new HttpsError('invalid-argument', 'Provide a topic between 3 and 80 characters.');
  }

  if (level.length < 2 || level.length > 40) {
    throw new HttpsError('invalid-argument', 'Provide a learner level between 2 and 40 characters.');
  }

  if (learningGoals.length < 10 || learningGoals.length > 400) {
    throw new HttpsError('invalid-argument', 'Provide learning goals between 10 and 400 characters.');
  }

  return {
    topic,
    level,
    learningGoals,
  };
}

async function generateLessonDraftWithGemini(generationInput) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY');
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${defaultLessonDraftModel}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildLessonDraftPrompt(generationInput) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          candidateCount: 1,
          temperature: 0.7,
          maxOutputTokens: 4096,
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini generation failed with status ${response.status}`);
  }

  const body = await response.json();
  const text = body?.candidates
    ?.flatMap((candidate) => candidate?.content?.parts ?? [])
    ?.map((part) => part?.text ?? '')
    ?.join('')
    ?.trim();

  if (!text) {
    throw new Error('Gemini returned an empty lesson draft.');
  }

  return JSON.parse(text);
}

function buildFallbackLessonDraft({ topic, level, learningGoals }) {
  const lessonId = slugifyLessonId(topic);
  const goalLines = learningGoals
    .split(/\n|,|;/)
    .map((goal) => goal.trim())
    .filter(Boolean)
    .slice(0, 3);
  const firstGoal = goalLines[0] ?? `Understand the basics of ${topic}`;
  const secondGoal = goalLines[1] ?? `Respond with confidence during ${topic.toLowerCase()} practice`;

  return {
    id: lessonId,
    title: topic,
    description: `A reviewed draft lesson for ${topic.toLowerCase()} focused on ${goalLines[0] ?? 'beginner practice'}.`,
    level,
    estimatedMinutes: 8,
    demoLabel: 'Generated scaffold pending admin review.',
    version: 'v1',
    supportedChallengeTypes: [...supportedChallengeTypes],
    challenges: [
      {
        id: `${lessonId}-flashcard-1`,
        type: 'flashcard',
        prompt: 'Meet the key expression.',
        basque: firstGoal,
        english: `Practice: ${firstGoal}`,
      },
      {
        id: `${lessonId}-flashcard-2`,
        type: 'flashcard',
        prompt: 'Add a supporting phrase.',
        basque: secondGoal,
        english: `Goal: ${secondGoal}`,
      },
      {
        id: `${lessonId}-quiz-1`,
        type: 'multiple-choice',
        prompt: 'Quick check · spot the learning goal.',
        question: `Which option best matches the lesson goal for ${topic}?`,
        options: [
          firstGoal,
          `Skip ${topic.toLowerCase()} practice`,
          `Memorize unrelated advanced grammar`,
        ],
        answer: firstGoal,
        explanation: 'The draft lesson should stay focused on the requested learner goal.',
      },
      {
        id: `${lessonId}-quiz-2`,
        type: 'multiple-choice',
        prompt: 'Quick check · stay at the right level.',
        question: `Which learner level should this draft target?`,
        options: [level, 'Expert only', 'Unspecified'],
        answer: level,
        explanation: 'The lesson stays aligned with the level chosen by the administrator.',
      },
    ],
  };
}

function buildLessonDraftPrompt({ topic, level, learningGoals }) {
  return [
    'You are helping an administrator draft a reviewed Basque learning lesson.',
    'Return only JSON with this exact shape:',
    '{',
    '  "id": "lowercase-hyphenated-string",',
    '  "title": "string",',
    '  "description": "string",',
    '  "level": "string",',
    '  "estimatedMinutes": number,',
    '  "demoLabel": "string",',
    '  "version": "string",',
    '  "supportedChallengeTypes": ["flashcard", "multiple-choice"],',
    '  "challenges": [',
    '    { "id": "string", "type": "flashcard", "prompt": "string", "basque": "string", "english": "string" },',
    '    { "id": "string", "type": "multiple-choice", "prompt": "string", "question": "string", "options": ["string"], "answer": "string", "explanation": "string" }',
    '  ]',
    '}',
    'Constraints:',
    '- Provide 3 to 6 challenges total.',
    '- Use only the supported challenge types shown above.',
    '- Keep the lesson safe for beginner-friendly language learning.',
    '- The output must be a draft only and must not describe itself as published.',
    '- Ensure each multiple-choice answer exactly matches one option.',
    `- Topic: ${topic}`,
    `- Learner level: ${level}`,
    `- Learning goals: ${learningGoals}`,
  ].join('\n');
}

function validateLessonDraft(lesson) {
  if (!lesson || typeof lesson !== 'object') {
    return ['The lesson draft is missing or invalid.'];
  }

  const errors = [];

  if (!lessonIdPattern.test(lesson.id || '')) {
    errors.push('Lesson ids must be 3 to 80 characters and use lowercase letters, numbers, or hyphens.');
  }

  validateString(errors, lesson.title, 3, 120, 'Lesson titles must be between 3 and 120 characters.');
  validateString(
    errors,
    lesson.description,
    10,
    280,
    'Descriptions must be between 10 and 280 characters.',
  );
  validateString(errors, lesson.level, 2, 40, 'Levels must be between 2 and 40 characters.');
  validateString(errors, lesson.demoLabel, 3, 160, 'Admin notes must be between 3 and 160 characters.');
  validateString(errors, lesson.version, 1, 40, 'Versions must be between 1 and 40 characters.');

  if (
    typeof lesson.estimatedMinutes !== 'number' ||
    !Number.isFinite(lesson.estimatedMinutes) ||
    lesson.estimatedMinutes < 1 ||
    lesson.estimatedMinutes > 30
  ) {
    errors.push('Estimated time must be between 1 and 30 minutes.');
  }

  const lessonSupportedChallengeTypes = Array.isArray(lesson.supportedChallengeTypes)
    ? [...new Set(lesson.supportedChallengeTypes.filter((type) => supportedChallengeTypes.includes(type)))]
    : [];

  if (
    lessonSupportedChallengeTypes.length < 1 ||
    lessonSupportedChallengeTypes.length !== lesson.supportedChallengeTypes.length
  ) {
    errors.push('Supported challenge types must contain unique supported values.');
  }

  if (!Array.isArray(lesson.challenges) || lesson.challenges.length < 1 || lesson.challenges.length > 12) {
    errors.push('Lessons must include between 1 and 12 challenges.');
    return errors;
  }

  lesson.challenges.forEach((challenge, index) => {
    validateChallenge(errors, challenge, index, lessonSupportedChallengeTypes);
  });

  return uniqueStrings(errors);
}

function validateChallenge(errors, challenge, index, lessonSupportedChallengeTypes) {
  const prefix = `Challenge ${index + 1}:`;

  if (!challenge || typeof challenge !== 'object') {
    errors.push(`${prefix} must be an object.`);
    return;
  }

  if (!lessonIdPattern.test(challenge.id || '')) {
    errors.push(`${prefix} ids must be 3 to 80 characters and use lowercase letters, numbers, or hyphens.`);
  }

  if (!lessonSupportedChallengeTypes.includes(challenge.type)) {
    errors.push(`${prefix} uses a challenge type that is not enabled for the lesson.`);
  }

  validateString(errors, challenge.prompt, 3, 160, `${prefix} prompts must be between 3 and 160 characters.`);

  if (challenge.type === 'flashcard') {
    validateString(
      errors,
      challenge.basque,
      1,
      80,
      `${prefix} Basque flashcard text must be between 1 and 80 characters.`,
    );
    validateString(
      errors,
      challenge.english,
      1,
      120,
      `${prefix} English flashcard text must be between 1 and 120 characters.`,
    );
    return;
  }

  if (challenge.type !== 'multiple-choice') {
    errors.push(`${prefix} must use a supported challenge type.`);
    return;
  }

  validateString(
    errors,
    challenge.question,
    3,
    180,
    `${prefix} questions must be between 3 and 180 characters.`,
  );
  validateString(
    errors,
    challenge.explanation,
    3,
    220,
    `${prefix} explanations must be between 3 and 220 characters.`,
  );

  if (!Array.isArray(challenge.options) || challenge.options.length < 2 || challenge.options.length > 5) {
    errors.push(`${prefix} options must contain between 2 and 5 choices.`);
    return;
  }

  if (
    challenge.options.some((option) => typeof option !== 'string' || option.length < 1 || option.length > 120) ||
    typeof challenge.answer !== 'string' ||
    !challenge.options.includes(challenge.answer)
  ) {
    errors.push(`${prefix} options must stay within 120 characters and include the selected answer.`);
  }
}

function validateString(errors, value, min, max, message) {
  if (typeof value !== 'string' || value.length < min || value.length > max) {
    errors.push(message);
  }
}

function slugifyLessonId(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function uniqueStrings(values) {
  return values.filter((value, index) => values.indexOf(value) === index);
}
