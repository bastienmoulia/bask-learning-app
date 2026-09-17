import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home').then((module) => module.HomeComponent),
  },
  {
    path: 'lesson/starter-basque-greetings',
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
