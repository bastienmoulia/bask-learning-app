import { Routes } from '@angular/router';
import { authGuard, signedOutGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./features/home/home').then((module) => module.HomeComponent),
  },
  {
    path: 'sign-in',
    canActivate: [signedOutGuard],
    loadComponent: () =>
      import('./features/sign-in/sign-in').then((module) => module.SignInComponent),
  },
  {
    path: 'lesson/starter-basque-greetings',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/lesson-player/lesson-player').then(
        (module) => module.LessonPlayerComponent,
      ),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
