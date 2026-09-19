# Bask Learning App

Bask is an Angular MVP for learning Basque from scratch with a playful, Duolingo-inspired experience. This first version focuses on a clean foundation: a dashboard, a short demo lesson, and Firebase-ready service abstractions that still run locally without live credentials.

## Current MVP scope

- Responsive home/dashboard screen introducing the product concept
- Starter Basque lesson with demo flashcards and multiple-choice practice
- Local learner session and progress persistence for safe offline/demo use
- Firebase configuration placeholders for future authentication and progress sync
- Angular unit tests for the starter lesson flow and key services

## Prerequisites

- Node.js 22+
- npm 10+
- Angular CLI is available through the local project scripts (`npx ng` / `npm run ...`)

## Local development

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm start
```

Open `http://localhost:4200/`.

## Useful Angular commands

```bash
npm start          # ng serve
npm run build      # production build
npm test -- --watch=false
npx ng generate component features/example
```

## Firebase setup

This repository does **not** include real Firebase credentials.

1. Create or open a Firebase project in the [Firebase console](https://console.firebase.google.com/).
2. Add a Web app to the project.
3. Copy the Firebase web configuration values.
4. Update `src/environments/environment.ts`:

```ts
export const environment = {
  production: false,
  firebase: {
    apiKey: 'your-api-key',
    authDomain: 'your-project.firebaseapp.com',
    projectId: 'your-project-id',
    storageBucket: 'your-project.firebasestorage.app',
    messagingSenderId: 'your-sender-id',
    appId: 'your-app-id',
  },
};
```

If those values stay empty, the app automatically remains in demo mode and still runs locally.

## Project structure

```text
src/
  app/
    core/
      firebase/          # safe Firebase bootstrap helpers
      services/          # auth and learner progress abstractions
    features/
      home/              # dashboard experience
      lesson-player/     # first starter lesson flow + demo content
  environments/
    environment.ts       # Firebase placeholders (no secrets)
```

## Testing

Run the unit tests:

```bash
npm test -- --watch=false
```

The initial test coverage focuses on:

- demo learner session creation
- local learner progress recording
- completion of the starter greetings lesson

## What is intentionally not included yet

- production authentication flows
- payments or subscriptions
- analytics
- a full Basque curriculum
- real Firestore persistence logic

Those areas can be added later on top of the current Angular structure and Firebase-ready abstractions.
