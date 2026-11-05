import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/api.service';
import { ToastService } from '../../../../core/toast.service';
import { ThemeService, ThemePreference } from '../../../../core/theme.service';
import { AuthService } from '../../../../core/auth.service';
import { UserSettings } from '../../../../core/models';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <div class="settings-header">
        <h1 class="page-title">Impostazioni</h1>
        <p class="page-subtitle">
          Personalizza l'esperienza d'uso, il fornitore mappe, il tema visivo e i promemoria via email.
        </p>
      </div>

      @if (loading()) {
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Caricamento preferenze...</p>
        </div>
      } @else {
        <div class="settings-form">
          <!-- 1. Fornitore Mappe -->
          <div class="glass-panel settings-card">
            <div class="card-header">
              <span class="card-icon">🗺️</span>
              <div>
                <h2>Fornitore di Mappe Esterno</h2>
                <p>Scegli quale servizio di mappe aprire quando visualizzi la posizione di uno spazio verde.</p>
              </div>
            </div>

            <div class="options-grid">
              <label
                class="option-tile"
                [class.selected]="settings.preferredMapProvider === 'osm'"
              >
                <input
                  type="radio"
                  name="mapProvider"
                  value="osm"
                  [(ngModel)]="settings.preferredMapProvider"
                />
                <div class="tile-content">
                  <div class="tile-title">OpenStreetMap</div>
                  <div class="tile-desc">Mappe aperte e libere della community</div>
                </div>
              </label>

              <label
                class="option-tile"
                [class.selected]="settings.preferredMapProvider === 'google'"
              >
                <input
                  type="radio"
                  name="mapProvider"
                  value="google"
                  [(ngModel)]="settings.preferredMapProvider"
                />
                <div class="tile-content">
                  <div class="tile-title">Google Maps</div>
                  <div class="tile-desc">Vista stradale e ricerca globale Google</div>
                </div>
              </label>

              <label
                class="option-tile"
                [class.selected]="settings.preferredMapProvider === 'apple'"
              >
                <input
                  type="radio"
                  name="mapProvider"
                  value="apple"
                  [(ngModel)]="settings.preferredMapProvider"
                />
                <div class="tile-content">
                  <div class="tile-title">Apple Maps</div>
                  <div class="tile-desc">Ideale per ecosistemi Apple e Safari</div>
                </div>
              </label>

              <label
                class="option-tile"
                [class.selected]="settings.preferredMapProvider === 'bing'"
              >
                <input
                  type="radio"
                  name="mapProvider"
                  value="bing"
                  [(ngModel)]="settings.preferredMapProvider"
                />
                <div class="tile-content">
                  <div class="tile-title">Bing Maps</div>
                  <div class="tile-desc">Mappe e percorsi Microsoft Bing</div>
                </div>
              </label>
            </div>
          </div>

          <!-- 2. Tema Visivo -->
          <div class="glass-panel settings-card">
            <div class="card-header">
              <span class="card-icon">🎨</span>
              <div>
                <h2>Tema dell'Interfaccia</h2>
                <p>Supporto alla modalità scura secondo le preferenze del sistema operativo o forzatura manuale.</p>
              </div>
            </div>

            <div class="options-grid">
              <label
                class="option-tile"
                [class.selected]="settings.themePreference === 'system'"
              >
                <input
                  type="radio"
                  name="themePref"
                  value="system"
                  [(ngModel)]="settings.themePreference"
                  (ngModelChange)="onThemeChange($event)"
                />
                <div class="tile-content">
                  <div class="tile-title">Predefinito di Sistema</div>
                  <div class="tile-desc">Segue automaticamente la modalità del dispositivo</div>
                </div>
              </label>

              <label
                class="option-tile"
                [class.selected]="settings.themePreference === 'light'"
              >
                <input
                  type="radio"
                  name="themePref"
                  value="light"
                  [(ngModel)]="settings.themePreference"
                  (ngModelChange)="onThemeChange($event)"
                />
                <div class="tile-content">
                  <div class="tile-title">Tema Chiaro</div>
                  <div class="tile-desc">Sfondo luminoso e toni botanici vivaci</div>
                </div>
              </label>

              <label
                class="option-tile"
                [class.selected]="settings.themePreference === 'dark'"
              >
                <input
                  type="radio"
                  name="themePref"
                  value="dark"
                  [(ngModel)]="settings.themePreference"
                  (ngModelChange)="onThemeChange($event)"
                />
                <div class="tile-content">
                  <div class="tile-title">Tema Scuro</div>
                  <div class="tile-desc">Sfondo profondo a risparmio energetico e riposante</div>
                </div>
              </label>
            </div>
          </div>

          <!-- 3. Promemoria Email e Notifiche -->
          <div class="glass-panel settings-card">
            <div class="card-header">
              <span class="card-icon">✉️</span>
              <div>
                <h2>Promemoria Email Giornaliero</h2>
                <p>Ricevi al mattino la lista delle piante che necessitano d'acqua con consigli pratici.</p>
              </div>
            </div>

            <div class="toggle-row">
              <div>
                <div class="toggle-title">Abilita riepilogo via email</div>
                <div class="toggle-desc">
                  Invia una notifica con schede per ogni pianta e pulsanti rapidi "Innaffiata" o "Ricorda fra".
                </div>
              </div>
              <label class="switch">
                <input
                  type="checkbox"
                  [(ngModel)]="settings.emailNotificationsEnabled"
                />
                <span class="slider round"></span>
              </label>
            </div>

            @if (settings.emailNotificationsEnabled) {
              <div class="email-details-panel">
                <div class="form-group time-group">
                  <label>Orario di invio del promemoria</label>
                  <input
                    type="time"
                    class="input-field time-input"
                    [(ngModel)]="settings.notificationTime"
                  />
                  <span class="input-hint">Orario locale consigliato all'inizio della giornata (es: 08:00)</span>
                </div>

                <div class="email-info-box">
                  <div class="info-icon">💡</div>
                  <div class="info-text">
                    <strong>Azioni dirette senza login:</strong>
                    Nelle email inviate potrai cliccare direttamente su
                    <span class="tag-example">Innaffiata</span> (che mostrerà una grande spunta verde animata di conferma) oppure su
                    <span class="tag-example">Ricorda fra</span> per posticipare di 1h, 4h, 8h, 24h o 48h con un solo click.
                  </div>
                </div>

                <div class="test-email-row">
                  <button
                    type="button"
                    class="btn btn-outline"
                    [disabled]="testingEmail()"
                    (click)="triggerTestEmail()"
                  >
                    @if (testingEmail()) {
                      <span>Invio in corso...</span>
                    } @else {
                      <span>Invia promemoria di prova adesso</span>
                    }
                  </button>
                  @if (authService.email()) {
                    <span class="current-email">Destinatario: {{ authService.email() }}</span>
                  }
                </div>
              </div>
            }
          </div>

          <!-- Bottom Actions -->
          <div class="save-bar">
            <button
              type="button"
              class="btn btn-primary btn-lg"
              [disabled]="saving()"
              (click)="saveSettings()"
            >
              @if (saving()) {
                <span>Salvataggio...</span>
              } @else {
                <span>Salva Impostazioni</span>
              }
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-container {
      max-width: 860px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
    }
    .settings-header {
      margin-bottom: 2rem;
    }
    .page-title {
      font-size: 2.2rem;
      font-weight: 800;
      color: var(--text-main);
      margin: 0 0 0.4rem 0;
      letter-spacing: -0.02em;
    }
    .page-subtitle {
      font-size: 1rem;
      color: var(--text-muted);
      margin: 0;
    }
    .settings-form {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }
    .settings-card {
      padding: 2rem;
      border-radius: var(--radius-lg);
    }
    .card-header {
      display: flex;
      gap: 1rem;
      align-items: flex-start;
      margin-bottom: 1.5rem;
    }
    .card-icon {
      font-size: 2rem;
      line-height: 1;
    }
    .card-header h2 {
      margin: 0 0 0.25rem 0;
      font-size: 1.25rem;
      color: var(--text-main);
    }
    .card-header p {
      margin: 0;
      font-size: 0.9rem;
      color: var(--text-muted);
    }
    .options-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
    }
    .option-tile {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 1rem;
      border-radius: var(--radius-md);
      background: var(--bg-surface-translucent);
      border: 1px solid var(--border-subtle);
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .option-tile input {
      margin-top: 0.25rem;
      accent-color: var(--color-primary);
    }
    .option-tile:hover {
      border-color: var(--border-strong);
    }
    .option-tile.selected {
      border-color: var(--color-primary);
      background: var(--color-primary-subtle);
    }
    .tile-title {
      font-weight: 700;
      font-size: 0.95rem;
      color: var(--text-main);
      margin-bottom: 0.2rem;
    }
    .tile-desc {
      font-size: 0.82rem;
      color: var(--text-muted);
      line-height: 1.35;
    }
    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1.5rem;
      padding: 1rem 0;
    }
    .toggle-title {
      font-weight: 700;
      font-size: 1rem;
      color: var(--text-main);
    }
    .toggle-desc {
      font-size: 0.88rem;
      color: var(--text-muted);
      margin-top: 0.2rem;
    }
    /* Switch */
    .switch {
      position: relative;
      display: inline-block;
      width: 52px;
      height: 30px;
      flex-shrink: 0;
    }
    .switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .slider {
      position: absolute;
      cursor: pointer;
      inset: 0;
      background-color: var(--border-strong);
      transition: 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      border-radius: 34px;
    }
    .slider:before {
      position: absolute;
      content: "";
      height: 22px;
      width: 22px;
      left: 4px;
      bottom: 4px;
      background-color: white;
      transition: 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }
    input:checked + .slider {
      background-color: var(--color-primary);
    }
    input:checked + .slider:before {
      transform: translateX(22px);
    }
    .email-details-panel {
      margin-top: 1.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border-subtle);
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .time-group {
      max-width: 260px;
    }
    .time-input {
      font-size: 1.1rem;
      font-weight: 600;
      padding: 0.5rem 0.75rem;
    }
    .input-hint {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-top: 0.3rem;
      display: block;
    }
    .email-info-box {
      display: flex;
      gap: 0.75rem;
      background: var(--color-primary-subtle);
      border: 1px solid var(--border-subtle);
      padding: 1rem 1.25rem;
      border-radius: var(--radius-md);
      font-size: 0.88rem;
      color: var(--text-main);
      line-height: 1.45;
    }
    .info-icon {
      font-size: 1.2rem;
    }
    .tag-example {
      display: inline-block;
      padding: 0.1rem 0.45rem;
      border-radius: var(--radius-sm);
      background: var(--bg-surface);
      font-weight: 600;
      color: var(--color-primary);
      border: 1px solid var(--border-subtle);
    }
    .test-email-row {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-top: 0.5rem;
      flex-wrap: wrap;
    }
    .current-email {
      font-size: 0.85rem;
      color: var(--text-muted);
    }
    .save-bar {
      display: flex;
      justify-content: flex-end;
      padding-top: 1rem;
      padding-bottom: 3rem;
    }
    .loading-state {
      text-align: center;
      padding: 4rem 0;
      color: var(--text-muted);
    }
    .spinner {
      margin: 0 auto 1rem;
      width: 36px;
      height: 36px;
      border: 3px solid rgba(16, 185, 129, 0.2);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `],
})
export class SettingsComponent implements OnInit {
  private readonly api = inject(ApiService);
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

  ngOnInit() {
    this.api.getSettings().subscribe({
      next: (s) => {
        this.settings = { ...s };
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Errore caricamento impostazioni');
        this.loading.set(false);
      },
    });
  }

  onThemeChange(newTheme: ThemePreference) {
    this.theme.setPreference(newTheme);
  }

  saveSettings() {
    this.saving.set(true);
    this.api.updateSettings(this.settings).subscribe({
      next: (updated) => {
        this.settings = { ...updated };
        this.theme.setPreference(updated.themePreference);
        this.toast.success('Impostazioni salvate con successo');
        this.saving.set(false);
      },
      error: () => {
        this.toast.error('Errore durante il salvataggio delle impostazioni');
        this.saving.set(false);
      },
    });
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

