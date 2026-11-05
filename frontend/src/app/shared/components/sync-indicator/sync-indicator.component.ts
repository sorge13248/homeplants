import { Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Dialog } from '@angular/cdk/dialog';
import { firstValueFrom } from 'rxjs';
import { SyncService } from '../../../core/sync.service';
import { ToastService } from '../../../core/toast.service';
import { ConfirmModalComponent } from '../confirm-modal/confirm-modal.component';

@Component({
  selector: 'app-sync-indicator',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="sync-container">
      <button
        type="button"
        class="sync-pill"
        [ngClass]="'status-' + status()"
        (click)="toggleDropdown($event)"
        title="Stato sincronizzazione e opzioni"
      >
        <!-- Icon -->
        <span class="icon-wrap" [class.spinning]="status() === 'syncing'">
          @if (status() === 'syncing') {
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
            </svg>
          } @else if (status() === 'online-ok') {
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          } @else if (status() === 'offline') {
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M22.61 16.95A5 5 0 0 0 18 10h-1.26a8 8 0 0 0-7.05-6M5 5a8 8 0 0 0-4 7h1.26a5 5 0 0 0 9.74 1.95"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          } @else if (status() === 'conflict') {
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          }
        </span>

        <span class="status-text">{{ statusShortLabel() }}</span>

        @if (pendingCount() > 0) {
          <span class="pending-badge">{{ pendingCount() }}</span>
        }
      </button>

      <!-- Glassmorphic Dropdown Menu -->
      @if (dropdownOpen()) {
        <div class="glass-modal sync-dropdown" (click)="$event.stopPropagation()">
          <div class="dropdown-header">
            <h4>Sincronizzazione Dati</h4>
            <div class="last-sync-time">
              <span>Ultimo sync:</span>
              <strong>{{ formattedLastSync() }}</strong>
            </div>
          </div>

          <div class="dropdown-body">
            <div class="status-row">
              <span class="dot" [ngClass]="'dot-' + status()"></span>
              <span class="status-desc">{{ statusDescription() }}</span>
            </div>

            @if (pendingCount() > 0) {
              <div class="pending-notice">
                {{ pendingCount() }} {{ pendingCount() === 1 ? 'modifica locale in attesa' : 'modifiche locali in attesa' }} di upload
              </div>
            }
          </div>

          <div class="dropdown-actions">
            <button
              type="button"
              class="btn btn-sm btn-primary w-full"
              [disabled]="status() === 'syncing' || !syncService.isOnline()"
              (click)="onForceSync()"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
              </svg>
              <span>Forza sync</span>
            </button>

            <button
              type="button"
              class="btn btn-sm btn-outline w-full btn-reset-server"
              [disabled]="status() === 'syncing' || !syncService.isOnline()"
              (click)="onResetServerVersion()"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              <span>Reset su versione del server</span>
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .sync-container {
      position: relative;
      display: inline-block;
    }
    .sync-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.4rem 0.8rem;
      border-radius: var(--radius-full);
      background: var(--bg-surface-translucent);
      border: 1px solid var(--border-subtle);
      color: var(--text-main);
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      backdrop-filter: var(--glass-blur);
      transition: all 0.2s ease;

      &:hover {
        border-color: var(--border-strong);
        background: var(--bg-surface);
      }
    }
    .status-online-ok {
      color: var(--color-success);
    }
    .status-syncing {
      color: var(--color-accent);
    }
    .status-offline {
      color: var(--text-muted);
    }
    .status-conflict {
      color: var(--color-warning);
    }
    .icon-wrap {
      display: flex;
      align-items: center;
    }
    .spinning {
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      100% { transform: rotate(360deg); }
    }
    .pending-badge {
      background: var(--color-warning);
      color: #ffffff;
      font-size: 0.72rem;
      padding: 0.1rem 0.45rem;
      border-radius: 9999px;
      font-weight: 700;
    }
    .sync-dropdown {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      width: 290px;
      padding: 1.25rem;
      z-index: 1000;
      animation: slideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes slideDown {
      0% { opacity: 0; transform: translateY(-8px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    .dropdown-header {
      border-bottom: 1px solid var(--border-subtle);
      padding-bottom: 0.75rem;
      margin-bottom: 0.75rem;

      h4 {
        margin: 0 0 0.35rem 0;
        font-size: 0.95rem;
        font-weight: 700;
        color: var(--text-main);
      }
      .last-sync-time {
        font-size: 0.8rem;
        color: var(--text-muted);
        display: flex;
        justify-content: space-between;
      }
    }
    .dropdown-body {
      margin-bottom: 1rem;
    }
    .status-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.86rem;
      color: var(--text-main);
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .dot-online-ok { background: var(--color-success); }
    .dot-syncing { background: var(--color-accent); }
    .dot-offline { background: var(--text-muted); }
    .dot-conflict { background: var(--color-warning); }

    .pending-notice {
      margin-top: 0.5rem;
      font-size: 0.8rem;
      color: var(--color-warning);
      background: rgba(245, 158, 11, 0.1);
      padding: 0.35rem 0.6rem;
      border-radius: 6px;
    }
    .dropdown-actions {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .w-full {
      width: 100%;
    }
    .btn-reset-server {
      color: var(--color-danger);
      &:hover {
        border-color: var(--color-danger);
        background: rgba(239, 68, 68, 0.08);
      }
    }
  `],
})
export class SyncIndicatorComponent {
  private readonly elementRef = inject(ElementRef);
  private readonly dialog = inject(Dialog);
  private readonly toast = inject(ToastService);
  readonly syncService = inject(SyncService);

  readonly dropdownOpen = signal(false);

  readonly status = computed(() => this.syncService.status());
  readonly pendingCount = computed(() => this.syncService.pendingCount());
  readonly lastSyncTime = computed(() => this.syncService.lastSyncTime());

  readonly formattedLastSync = computed(() => {
    const time = this.lastSyncTime();
    if (!time) return 'Mai';
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(time);
  });

  readonly statusShortLabel = computed(() => {
    switch (this.status()) {
      case 'syncing':
        return 'Sincronizzo...';
      case 'online-ok':
        return 'In linea';
      case 'offline':
        return 'Offline';
      case 'conflict':
        return 'Conflitto';
    }
  });

  readonly statusDescription = computed(() => {
    switch (this.status()) {
      case 'syncing':
        return 'Sincronizzazione in corso...';
      case 'online-ok':
        return 'Sincronizzato con il server';
      case 'offline':
        return 'Disconnesso (dati salvati in locale)';
      case 'conflict':
        return 'Conflitto di sincronizzazione rilevato';
    }
  });

  toggleDropdown(event?: Event): void {
    event?.stopPropagation();
    this.dropdownOpen.update((v) => !v);
  }

  closeDropdown(): void {
    this.dropdownOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.closeDropdown();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeDropdown();
  }

  async onForceSync(): Promise<void> {
    this.closeDropdown();
    try {
      await this.syncService.sync();
      this.toast.success('Sincronizzazione completata');
    } catch {
      this.toast.error('Errore durante la sincronizzazione');
    }
  }

  async onResetServerVersion(): Promise<void> {
    this.closeDropdown();

    const dialogRef = this.dialog.open<boolean>(ConfirmModalComponent, {
      data: {
        title: 'Scaricare la versione dal server?',
        message:
          'Questa operazione sostituirà tutti i dati locali con l\'ultima versione presente sul server. Eventuali modifiche locali non sincronizzate andranno perse. Vuoi continuare?',
        confirmLabel: 'Scarica dal server',
        cancelLabel: 'Annulla',
        confirmVariant: 'danger',
      },
    });

    const confirmed = await firstValueFrom(dialogRef.closed);
    if (!confirmed) {
      return;
    }

    try {
      await this.syncService.downloadServerVersion();
      this.toast.success('Versione del server scaricata con successo');
    } catch {
      this.toast.error('Errore durante il download dal server');
    }
  }
}

