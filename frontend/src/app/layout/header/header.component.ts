import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ThemeService } from '../../core/theme.service';
import { SyncIndicatorComponent } from '../../shared/components/sync-indicator/sync-indicator.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, SyncIndicatorComponent],
  template: `
    <header class="glass-panel main-header">
      <div class="header-left">
        <a routerLink="/" class="brand-logo">
          <span class="logo-icon">🌿</span>
          <span class="brand-name">HomePlants</span>
        </a>

        @if (authService.isAuthenticated()) {
          <nav class="nav-links">
            <a routerLink="/spaces" routerLinkActive="active" class="nav-item">
              Spazi Verdi
            </a>
            <a routerLink="/plants" routerLinkActive="active" class="nav-item">
              Catalogo Piante
            </a>
            <a routerLink="/settings" routerLinkActive="active" class="nav-item">
              Impostazioni
            </a>
          </nav>
        }
      </div>

      <div class="header-right">
        @if (authService.isAuthenticated()) {
          <!-- Sync Indicator Dropdown -->
          <app-sync-indicator />

          <!-- Theme Toggle -->
          <button
            type="button"
            class="header-icon-btn"
            (click)="toggleTheme()"
            [title]="'Tema attuale: ' + themeService.preference()"
          >
            @if (themeService.effectiveTheme() === 'dark') {
              <!-- Moon -->
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            } @else {
              <!-- Sun -->
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            }
          </button>

          <!-- User Profile & Logout -->
          <div class="user-profile">
            @if (authService.pictureUrl()) {
              <img [src]="authService.pictureUrl()" [alt]="authService.displayName()" class="avatar" />
            } @else {
              <div class="avatar-placeholder">{{ authService.initials() }}</div>
            }
            <button type="button" class="logout-btn" (click)="authService.logout()" title="Disconnettiti">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </button>
          </div>
        }
      </div>
    </header>
  `,
  styles: [`
    .main-header {
      position: sticky;
      top: 1rem;
      z-index: 100;
      margin: 0.75rem auto 1.5rem;
      max-width: 1200px;
      width: calc(100% - 1.5rem);
      padding: 0.65rem 1.25rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-radius: var(--radius-full);
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 2rem;
    }
    .brand-logo {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      text-decoration: none;
      color: var(--text-main);
      font-weight: 700;
      font-size: 1.15rem;
    }
    .logo-icon {
      font-size: 1.4rem;
    }
    .nav-links {
      display: flex;
      gap: 0.5rem;
    }
    .nav-item {
      text-decoration: none;
      color: var(--text-muted);
      font-size: 0.92rem;
      font-weight: 600;
      padding: 0.45rem 0.9rem;
      border-radius: var(--radius-full);
      transition: all 0.2s ease;

      &:hover {
        color: var(--text-main);
        background: var(--color-primary-subtle);
      }
      &.active {
        color: #ffffff;
        background: var(--color-primary);
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);
      }
    }
    .header-right {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .header-icon-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--bg-surface-translucent);
      border: 1px solid var(--border-subtle);
      color: var(--text-main);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        background: var(--bg-surface);
        border-color: var(--border-strong);
      }
    }
    .user-profile {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-left: 0.25rem;
    }
    .avatar, .avatar-placeholder {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      object-fit: cover;
    }
    .avatar-placeholder {
      background: var(--color-primary);
      color: #ffffff;
      font-size: 0.8rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .logout-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 0.35rem;
      display: flex;
      align-items: center;
      border-radius: 50%;
      transition: color 0.2s;

      &:hover {
        color: var(--color-danger);
      }
    }

    @media (max-width: 768px) {
      .brand-name {
        display: none;
      }
      .header-left {
        gap: 0.75rem;
      }
      .nav-item {
        padding: 0.4rem 0.6rem;
        font-size: 0.82rem;
      }
    }
  `],
})
export class HeaderComponent {
  readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);

  toggleTheme() {
    const current = this.themeService.preference();
    if (current === 'system') {
      this.themeService.setPreference('dark');
    } else if (current === 'dark') {
      this.themeService.setPreference('light');
    } else {
      this.themeService.setPreference('system');
    }
  }
}

