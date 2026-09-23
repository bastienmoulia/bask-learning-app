import { Component, effect, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  selector: 'app-root',
  standalone: true,
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class AppComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly year = new Date().getFullYear();
  protected readonly isSignedIn = this.authService.isSignedIn;
  protected readonly isAdmin = this.authService.isAdmin;
  protected readonly isLoading = this.authService.isLoading;
  protected readonly learner = this.authService.learner;

  constructor() {
    effect(() => {
      if (this.isLoading() || this.isSignedIn()) {
        return;
      }

      const currentUrl = this.router.url;

      if (currentUrl.startsWith('/sign-in')) {
        return;
      }

      void this.router.navigate(['/sign-in'], {
        queryParams: currentUrl === '/' ? undefined : { returnUrl: currentUrl },
      });
    });
  }

  protected async signOut() {
    const didSignOut = await this.authService.signOut();

    if (didSignOut) {
      await this.router.navigateByUrl('/sign-in');
    }
  }
}
