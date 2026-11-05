import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/auth.service';

@Component({
  selector: 'app-session-expired-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (authService.sessionExpired()) {
      <div class="modal-backdrop">
        <div class="glass-modal modal-card">
          <div class="icon-wrap">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <h2>Sessione Scaduta</h2>
          <p>La tua sessione di accesso è scaduta. Rinnova la sessione o accedi di nuovo per continuare a gestire le tue piante.</p>
          <div class="actions">
            <button type="button" class="btn btn-outline" (click)="authService.logout()">
              Esci
            </button>
            <button type="button" class="btn btn-primary" (click)="authService.renewSession()">
              Rinnova Sessione
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 10000;
      background: rgba(10, 17, 14, 0.75);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .modal-card {
      max-width: 420px;
      width: 100%;
      padding: 2rem;
      text-align: center;
    }
    .icon-wrap {
      color: var(--color-warning);
      margin-bottom: 1rem;
    }
    h2 {
      margin: 0 0 0.5rem;
      font-size: 1.35rem;
      color: var(--text-main);
    }
    p {
      color: var(--text-muted);
      font-size: 0.95rem;
      margin-bottom: 1.5rem;
      line-height: 1.5;
    }
    .actions {
      display: flex;
      justify-content: center;
      gap: 0.75rem;
    }
  `],
})
export class SessionExpiredModalComponent {
  readonly authService = inject(AuthService);
}

