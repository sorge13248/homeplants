import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="login-wrapper">
      <div class="glass-modal login-card">
        <div class="logo-badge">🌿</div>
        <h1 class="brand-title">HomePlants</h1>
        <p class="brand-subtitle">
          La tua oasi botanica digitale per monitorare e curare le piante di casa e giardino.
        </p>

        <div class="card-content">
          @if (errorMessage()) {
            <div class="error-banner">
              {{ errorMessage() }}
            </div>
          }

          <button
            type="button"
            class="btn btn-primary btn-block btn-lg"
            [disabled]="loading()"
            (click)="handleLogin()"
          >
            @if (loading()) {
              <span class="spinner"></span>
              <span>Connessione in corso...</span>
            } @else {
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                <polyline points="10 17 15 12 10 7"></polyline>
                <line x1="15" y1="12" x2="3" y2="12"></line>
              </svg>
              <span>Accedi a HomePlants</span>
            }
          </button>

          <div class="features-list">
            <div class="feature-item">
              <span class="feature-icon">💧</span>
              <span>Monitoraggio innaffiature e promemoria quotidiani</span>
            </div>
            <div class="feature-item">
              <span class="feature-icon">🏡</span>
              <span>Spazi, stanze e schede botaniche stagionali</span>
            </div>
            <div class="feature-item">
              <span class="feature-icon">🔄</span>
              <span>Sincronizzazione offline e PWA sempre disponibile</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-wrapper {
      min-height: calc(100vh - 120px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem 1rem;
    }
    .login-card {
      max-width: 460px;
      width: 100%;
      padding: 3rem 2.5rem;
      text-align: center;
      border-radius: var(--radius-lg);
    }
    .logo-badge {
      font-size: 3.5rem;
      line-height: 1;
      margin-bottom: 1rem;
      filter: drop-shadow(0 4px 12px rgba(16, 185, 129, 0.3));
    }
    .brand-title {
      font-size: 2.2rem;
      font-weight: 800;
      color: var(--text-main);
      margin: 0 0 0.5rem 0;
      letter-spacing: -0.02em;
    }
    .brand-subtitle {
      font-size: 0.96rem;
      color: var(--text-muted);
      line-height: 1.5;
      margin: 0 0 2rem 0;
    }
    .btn-block {
      width: 100%;
      justify-content: center;
      padding: 0.9rem 1.5rem;
      font-size: 1.05rem;
    }
    .error-banner {
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid var(--color-danger);
      color: var(--color-danger);
      padding: 0.75rem 1rem;
      border-radius: var(--radius-md);
      font-size: 0.9rem;
      margin-bottom: 1.25rem;
    }
    .spinner {
      display: inline-block;
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: #fff;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .features-list {
      margin-top: 2.5rem;
      padding-top: 2rem;
      border-top: 1px solid var(--border-subtle);
      display: flex;
      flex-direction: column;
      gap: 1rem;
      text-align: left;
    }
    .feature-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.9rem;
      color: var(--text-secondary);
    }
    .feature-icon {
      font-size: 1.2rem;
    }
  `],
})
export class LoginComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit() {
    if (this.auth.isAuthenticated()) {
      this.router.navigate(['/spaces']);
    }
  }

  async handleLogin() {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      await this.auth.login();
    } catch (err: any) {
      this.errorMessage.set(err?.message || 'Accesso non riuscito. Riprova più tardi.');
      this.loading.set(false);
    }
  }
}

