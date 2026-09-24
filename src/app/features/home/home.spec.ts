import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { FIREBASE_SERVICES } from '../../core/firebase/firebase';
import { AuthService } from '../../core/services/auth';
import { LessonsService } from '../../core/services/lessons';
import { HomeComponent } from './home';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;
  const listPublishedLessons = vi.fn();

  beforeEach(async () => {
    localStorage.clear();
    listPublishedLessons.mockReset().mockResolvedValue({
      lessons: [
        {
          kind: 'published',
          id: 'starter-basque-greetings',
          title: 'Basque greetings',
          description: 'A tiny demo lesson focused on saying hello, goodbye, and thanks in Basque.',
          level: 'Starter demo',
          estimatedMinutes: 4,
          demoLabel: 'Published fallback content for local/demo mode.',
          version: 'v1',
          supportedChallengeTypes: ['flashcard', 'multiple-choice'],
          published: true,
          publishedAt: '2026-09-23T00:00:00.000Z',
          challenges: [],
        },
        {
          kind: 'published',
          id: 'basque-travel-basics',
          title: 'Basque travel basics',
          description: 'Practice a few travel phrases for beginner learners.',
          level: 'Beginner',
          estimatedMinutes: 6,
          demoLabel: 'Published after admin review.',
          version: 'v1',
          supportedChallengeTypes: ['flashcard', 'multiple-choice'],
          published: true,
          publishedAt: '2026-09-23T00:00:00.000Z',
          challenges: [],
        },
      ],
      feedback: null,
      source: 'firestore',
    });

    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            learner: signal({
              id: 'learner-123',
              displayName: 'Ane learner',
              email: 'ane@example.com',
              role: 'learner',
            }).asReadonly(),
          },
        },
        {
          provide: FIREBASE_SERVICES,
          useValue: {
            app: null,
            appCheck: null,
            auth: null,
            firestore: null,
            functions: null,
            appCheckEnabled: false,
            isConfigured: false,
          },
        },
        {
          provide: LessonsService,
          useValue: {
            listPublishedLessons,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the starter lesson CTA, the signed-in learner, and the published lesson catalog', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Start the first lesson');
    expect(element.textContent).toContain('Basque greetings');
    expect(element.textContent).toContain('Basque travel basics');
    expect(element.textContent).toContain('Ane learner');
    expect(element.textContent).toContain('ane@example.com');
  });
});
