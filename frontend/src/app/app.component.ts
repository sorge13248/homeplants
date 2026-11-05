import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './layout/header/header.component';
import { SessionExpiredModalComponent } from './shared/components/session-expired-modal/session-expired-modal.component';
import { ToastService } from './core/toast.service';
import { SyncService } from './core/sync.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, HeaderComponent, SessionExpiredModalComponent],
  template: `
    <div class="app-shell">
      <app-header />

      <main class="main-content">
        <router-outlet />
      </main>

      <app-session-expired-modal />

      <!-- Toast Notification Container -->
      <div class="toast-container" aria-live="polite">
        @for (toast of toastService.toasts(); track toast.id) {
          <div
            class="toast glass-panel"
            [ngClass]="'toast-' + toast.type"
            (click)="toastService.dismiss(toast.id)"
          >
            <div class="toast-icon">
              @if (toast.type === 'success') {
                ✓
              } @else if (toast.type === 'error') {
                ✕
              } @else {
                ℹ
              }
            </div>
            <div class="toast-message">{{ toast.message }}</div>
            <button type="button" class="toast-close">✕</button>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .app-shell {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .toast-container {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      pointer-events: none;
      max-width: 400px;
      width: calc(100vw - 4rem);
    }
    .toast {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.85rem 1.25rem;
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg);
      cursor: pointer;
      animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      border-left: 4px solid transparent;
    }
    .toast-success {
      border-left-color: var(--color-success);
    }
    .toast-error {
      border-left-color: var(--color-danger);
    }
    .toast-info {
      border-left-color: var(--color-accent);
    }
    .toast-icon {
      font-weight: 800;
      font-size: 1.1rem;
    }
    .toast-success .toast-icon {
      color: var(--color-success);
    }
    .toast-error .toast-icon {
      color: var(--color-danger);
    }
    .toast-info .toast-icon {
      color: var(--color-accent);
    }
    .toast-message {
      flex: 1;
      font-size: 0.92rem;
      color: var(--text-main);
      font-weight: 500;
      line-height: 1.4;
    }
    .toast-close {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 0.85rem;
    }
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(16px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `],
})
export class AppComponent {
  readonly toastService = inject(ToastService);
  private readonly syncService = inject(SyncService);
}
