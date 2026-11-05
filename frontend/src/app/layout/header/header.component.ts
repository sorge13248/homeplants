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
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
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

