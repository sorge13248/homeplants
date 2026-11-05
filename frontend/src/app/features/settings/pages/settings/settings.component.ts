import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/api.service';
import { OfflineStorageService } from '../../../../core/offline-storage.service';
import { SyncService } from '../../../../core/sync.service';
import { ToastService } from '../../../../core/toast.service';
import { ThemeService, ThemePreference } from '../../../../core/theme.service';
import { AuthService } from '../../../../core/auth.service';
import { UserSettings } from '../../../../core/models';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly storage = inject(OfflineStorageService);
  private readonly syncService = inject(SyncService);
  private readonly toast = inject(ToastService);
  private readonly theme = inject(ThemeService);
  readonly authService = inject(AuthService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly testingEmail = signal(false);

  settings: UserSettings = {
    preferredMapProvider: 'osm',
    themePreference: 'system',
    emailNotificationsEnabled: true,
    notificationTime: '08:00',
  };

  async ngOnInit() {
    await this.loadSettings();
  }

  async loadSettings() {
    try {
      const s = await this.storage.getSettings();
      if (s) {
        this.settings = { ...s };
        this.theme.setPreference(s.themePreference);
      }
    } catch {
      this.toast.error('Errore caricamento impostazioni');
    } finally {
      this.loading.set(false);
    }
  }

  onThemeChange(newTheme: ThemePreference) {
    this.theme.setPreference(newTheme);
  }

  async saveSettings() {
    this.saving.set(true);
    try {
      await this.storage.saveSettings(this.settings);
      await this.syncService.queueSettingsChange(this.settings);
      this.theme.setPreference(this.settings.themePreference);
      this.toast.success('Impostazioni salvate con successo');
    } catch {
      this.toast.error('Errore durante il salvataggio delle impostazioni');
    } finally {
      this.saving.set(false);
    }
  }

  triggerTestEmail() {
    this.testingEmail.set(true);
    this.api.sendTestNotification().subscribe({
      next: (res) => {
        if (res.sent) {
          this.toast.success(res.message);
        } else {
          this.toast.info(res.message);
        }
        this.testingEmail.set(false);
      },
      error: () => {
        this.toast.error('Errore durante l’invio del promemoria di prova');
        this.testingEmail.set(false);
      },
    });
  }
}

