import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthService);
  });

  it('creates a demo learner without Firebase credentials', () => {
    const learner = service.continueAsGuest();

    expect(service).toBeTruthy();
    if (!learner) {
      throw new Error('Expected a learner session to be created.');
    }
    expect(learner.mode).toBe('demo');
    expect(service.isSignedIn()).toBe(true);
    expect(service.connectionLabel()).toContain('Demo mode');
  });
});
