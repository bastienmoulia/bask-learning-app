import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FIREBASE_SERVICES } from '../../core/firebase/firebase';
import { AuthService } from '../../core/services/auth';
import { HomeComponent } from './home';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;

  beforeEach(async () => {
    localStorage.clear();
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
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the starter lesson CTA and the signed-in learner', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Start the first lesson');
    expect(element.textContent).toContain('Basque greetings');
    expect(element.textContent).toContain('Ane learner');
    expect(element.textContent).toContain('ane@example.com');
  });
});
