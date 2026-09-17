import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HomeComponent } from './home';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the starter lesson CTA', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Start the first lesson');
    expect(element.textContent).toContain('Basque greetings');
  });

  it('starts a demo learner only after the user asks for it', () => {
    const element = fixture.nativeElement as HTMLElement;
    const button = element.querySelector('.panel-card__action') as HTMLButtonElement;

    expect(component['learner']()).toBeNull();

    button.click();
    fixture.detectChanges();

    expect(component['learner']()?.displayName).toBe('Guest explorer');
  });
});
