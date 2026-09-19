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

export interface StarterLesson {
  id: string;
  title: string;
  description: string;
  level: string;
  estimatedMinutes: number;
  demoLabel: string;
  challenges: LessonChallenge[];
}

export const starterLesson: StarterLesson = {
  id: 'starter-basque-greetings',
  title: 'Basque greetings',
  description: 'A tiny demo lesson focused on saying hello, goodbye, and thanks in Basque.',
  level: 'Starter demo',
  estimatedMinutes: 4,
  demoLabel: 'Demo content — expand into a full curriculum later.',
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
