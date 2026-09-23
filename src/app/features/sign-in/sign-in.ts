import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth';

@Component({
  selector: 'app-sign-in',
  imports: [FormsModule],
  standalone: true,
  templateUrl: './sign-in.html',
  styleUrl: './sign-in.scss',
})
export class SignInComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly learner = this.authService.learner;
  protected readonly feedback = this.authService.feedback;
  protected readonly isLoading = this.authService.isLoading;
  protected readonly isConfigured = this.authService.isConfigured;

  constructor() {
    effect(() => {
      if (this.isLoading() || !this.learner()) {
        return;
      }

      void this.router.navigateByUrl(this.getReturnUrl());
    });
  }

  protected async signInWithEmail() {
    await this.authService.signInWithEmail(this.email(), this.password());
  }

  protected async registerWithEmail() {
    await this.authService.registerWithEmail(this.email(), this.password());
  }

  protected async resetPassword() {
    await this.authService.sendPasswordReset(this.email());
  }

  protected async signInWithGoogle() {
    await this.authService.signInWithGoogle();
  }

  protected async signInWithApple() {
    await this.authService.signInWithApple();
  }

  private getReturnUrl() {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');

    return returnUrl && returnUrl !== '/sign-in' ? returnUrl : '/';
  }
}
