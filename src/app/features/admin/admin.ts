import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { AdminUsersService } from '../../core/services/admin-users';
import { AuthService } from '../../core/services/auth';
import { UserProfileDocument } from '../../core/services/user-profiles';

@Component({
  selector: 'app-admin',
  imports: [DatePipe],
  standalone: true,
  templateUrl: './admin.html',
})
export class AdminComponent {
  private readonly authService = inject(AuthService);
  private readonly adminUsersService = inject(AdminUsersService);

  protected readonly currentLearner = this.authService.learner;
  protected readonly users = this.adminUsersService.users;
  protected readonly feedback = this.adminUsersService.feedback;
  protected readonly isLoading = this.adminUsersService.isLoading;
  protected readonly activeUserId = this.adminUsersService.activeUserId;

  protected async promote(user: UserProfileDocument) {
    await this.adminUsersService.setUserRole(user.uid, 'admin');
  }

  protected async revoke(user: UserProfileDocument) {
    await this.adminUsersService.setUserRole(user.uid, 'learner');
  }

  protected isCurrentUser(user: UserProfileDocument) {
    return this.currentLearner()?.id === user.uid;
  }
}
