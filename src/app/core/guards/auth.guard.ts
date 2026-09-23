import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

export const authGuard: CanActivateFn = async (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.whenReady();

  if (authService.isSignedIn()) {
    return true;
  }

  return router.createUrlTree(['/sign-in'], {
    queryParams: {
      returnUrl: state.url,
    },
  });
};

export const signedOutGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.whenReady();

  return authService.isSignedIn() ? router.createUrlTree(['/']) : true;
};

export const adminGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.whenReady();

  if (!authService.isSignedIn()) {
    return router.createUrlTree(['/sign-in'], {
      queryParams: {
        returnUrl: '/admin',
      },
    });
  }

  return authService.isAdmin() ? true : router.createUrlTree(['/']);
};
