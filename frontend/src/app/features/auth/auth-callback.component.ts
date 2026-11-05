import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="callback-container">
      <div class="glass-modal callback-card">
        <div class="spinner"></div>
        <h2>Accesso in corso...</h2>
        <p>Stiamo finalizzando la tua autenticazione su HomePlants.</p>
      </div>
    </div>
  `,
  styles: [`
    .callback-container {
      min-height: calc(100vh - 120px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .callback-card {
      max-width: 400px;
      width: 100%;
      padding: 3rem 2rem;
      text-align: center;
      border-radius: var(--radius-lg);
    }
    .spinner {
      margin: 0 auto 1.5rem;
      width: 44px;
      height: 44px;
      border: 3px solid rgba(16, 185, 129, 0.2);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    h2 {
      margin: 0 0 0.5rem;
      font-size: 1.4rem;
      color: var(--text-main);
    }
    p {
      margin: 0;
      color: var(--text-muted);
      font-size: 0.95rem;
    }
  `],
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

