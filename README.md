# Bask Learning App

Bask is an Angular MVP for learning Basque from scratch with a playful, Duolingo-inspired experience. This version focuses on a clean foundation: a dashboard, a published starter lesson, Firebase Authentication, Firestore-backed learner progress, and optional AI-assisted extra practice.

## Current MVP scope

- Responsive home/dashboard screen introducing the product concept
- Published starter Basque lesson loaded from Firestore with a reviewed local fallback
- Firebase Authentication with email/password, Google, and Apple sign-in flows
- Firestore-backed learner progress persistence scoped to the authenticated Firebase user
- Firestore-backed user profiles with learner/admin roles and an admin management screen
- Optional AI-assisted extra practice with App Check protection and client-side rate limiting
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

This repository expects a Firebase project configuration for the web app plus enabled Authentication providers.

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

Enable the Email/Password, Google, and Apple providers in Firebase Authentication before testing those sign-in flows.

### User profiles and administrator access

When a learner signs in for the first time, the app provisions a Firestore document at
`users/{uid}` with a default `learner` role. The `/admin` page is only available to signed-in
administrators and lets them promote learners to admins or revoke admin access through a callable
Cloud Function.

Provision the first admin outside the client with the bootstrap script in `functions/`:

```bash
cd functions
npm install
npm run bootstrap:initial-admin -- <firebase-auth-uid>
```

The bootstrap script refuses to replace an existing admin, so it can be used as a trusted one-time
setup step after the first account has been created in Firebase Authentication.

### Published lesson content

Create a Firestore document at `publishedLessons/starter-basque-greetings` with the same shape as
`src/app/features/lesson-player/starter-lesson.ts` if you want the app to read reviewed lesson
content from Firestore. If the document is missing or invalid, the app falls back to the reviewed
local lesson bundled with the client.

### App Check and personalized practice

Personalized practice is optional and only runs when:

- `environment.appCheck.siteKey` is configured for web App Check
- Firebase AI Logic is provisioned for the project
- the learner stays within the configured hourly request limit

The default local configuration keeps these values empty, so the published lesson still works even
when personalized generation is unavailable.

## Project structure

```text
src/
  app/
    core/
      firebase/          # safe Firebase bootstrap helpers
      services/          # auth, lesson loading, progress, and practice abstractions
    features/
      home/              # dashboard experience
      lesson-player/     # published lesson flow + validated extra practice
  environments/
    environment.ts       # Firebase placeholders (no secrets)
```

## Testing

Run the unit tests:

```bash
npm test -- --watch=false
```

The initial test coverage focuses on:

- Firebase auth restoration and sign-in errors
- learner progress recording per authenticated learner
- loading published lesson content with fallback
- completion of the starter greetings lesson and validated extra practice flow

## iOS TestFlight deployment

The manually triggered [TestFlight workflow](.github/workflows/ios-testflight.yml) builds the Angular app, syncs Capacitor, signs an iOS archive, and uploads its IPA to App Store Connect. It requires an Apple Developer Program membership and an App Store Connect app registered with bundle ID `bastienmoulia.bask.learning.app` under the same team. Configure the following in GitHub repository **Settings > Secrets and variables > Actions**:

| Type | Name | Value |
| --- | --- | --- |
| Variable | `APPLE_TEAM_ID` | Apple Developer team ID |
| Secret | `IOS_DISTRIBUTION_CERTIFICATE` | Base64-encoded Apple Distribution `.p12` certificate **with its private key** |
| Secret | `IOS_CERTIFICATE_PASSWORD` | Password used when exporting the `.p12` |
| Secret | `IOS_PROVISIONING_PROFILE` | Base64-encoded App Store Connect distribution `.mobileprovision` profile for that bundle ID and certificate |
| Secret | `APP_STORE_CONNECT_API_KEY` | Full contents of an App Store Connect API `.p8` private key |
| Secret | `APP_STORE_CONNECT_KEY_ID` | Key ID for that API key |
| Secret | `APP_STORE_CONNECT_ISSUER_ID` | Issuer ID for that API key |

Create the distribution certificate and App Store Connect provisioning profile in the Apple Developer portal, and an API key with app-upload permissions in App Store Connect. For the binary secrets, run `base64 < distribution.p12 | tr -d '\n'` and `base64 < distribution.mobileprovision | tr -d '\n'` locally and put the results in GitHub; never commit these files or keys. Keep the `.p8` key as plain multiline text in its secret. On macOS, create the `.p12` by exporting the certificate **and private key** from Keychain Access.

Run **Deploy iOS to TestFlight** from the repository Actions tab. Each run sets a distinct iOS build number; maintain the marketing version in Xcode as needed. After upload, allow App Store Connect time to process the build and configure TestFlight testers and export compliance there. The upload is not an App Store release. The workflow requires a macOS runner with Xcode and cannot be fully tested on a machine with only Xcode Command Line Tools.

## What is intentionally not included yet

- payments or subscriptions
- analytics
- a full Basque curriculum
- an admin publishing workflow for lesson content beyond role management

Those areas can be added later on top of the current Angular structure and Firebase-ready abstractions.
