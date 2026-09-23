import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { AppComponent } from './app';
import { AuthService } from './core/services/auth';

describe('App', () => {
  const signOut = vi.fn().mockResolvedValue(true);

  beforeEach(async () => {
    signOut.mockReset().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            isSignedIn: signal(true).asReadonly(),
            isAdmin: signal(true).asReadonly(),
            isLoading: signal(false).asReadonly(),
            learner: signal({
              id: 'learner-123',
              displayName: 'Learner',
              email: 'learner@example.com',
              role: 'admin',
            }).asReadonly(),
            signOut,
          },
        },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('renders the authenticated navigation and supports sign-out', async () => {
    const router = TestBed.inject(Router);
    const navigateByUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand strong')?.textContent).toContain('Bask');
    expect(compiled.textContent).toContain('First lesson');
    expect(compiled.textContent).toContain('Admin');

    const button = compiled.querySelector('.topbar__action') as HTMLButtonElement;
    button.click();
    await fixture.whenStable();

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(navigateByUrlSpy).toHaveBeenCalledWith('/sign-in');
  });
});
