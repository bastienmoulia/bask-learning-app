import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { UrlTree } from '@angular/router';
import { vi } from 'vitest';
import { authGuard } from './core/guards/auth.guard';
import { AuthService } from './core/services/auth';

describe('authGuard', () => {
  it('waits for auth restoration before redirecting unauthenticated learners', async () => {
    let releaseAuthReady: (() => void) | undefined;
    let settled = false;

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            whenReady: vi.fn(
              () =>
                new Promise<void>((resolve) => {
                  releaseAuthReady = resolve;
                }),
            ),
            isSignedIn: vi.fn(() => false),
          },
        },
      ],
    });

    const router = TestBed.inject(Router);
    const guardResultPromise = TestBed.runInInjectionContext(async () =>
      authGuard({} as never, { url: '/lesson/starter-basque-greetings' } as never),
    );

    guardResultPromise.then(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(settled).toBe(false);

    releaseAuthReady?.();
    const guardResult = await guardResultPromise;

    expect(guardResult).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(guardResult as UrlTree)).toBe(
      '/sign-in?returnUrl=%2Flesson%2Fstarter-basque-greetings',
    );
  });
});
