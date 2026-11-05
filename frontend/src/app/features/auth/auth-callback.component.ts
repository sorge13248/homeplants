import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './auth-callback.component.html',
  styleUrl: './auth-callback.component.scss',
})
export class AuthCallbackComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  async ngOnInit() {
    try {
      await this.auth.completeCallback(window.location.href);
      const returnUrl = this.auth.consumeReturnUrl() || '/spaces';
      await this.router.navigateByUrl(returnUrl);
    } catch {
      await this.router.navigate(['/login']);
    }
  }
}

