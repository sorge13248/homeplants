import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { ApiService } from '../../../../core/api.service';
import { MapProviderService } from '../../../../core/map-provider.service';
import { ToastService } from '../../../../core/toast.service';
import { SpaceItem, UserSettings } from '../../../../core/models';
import { AppCardComponent } from '../../../../shared/components/app-card/app-card.component';
import { ConfirmModalComponent } from '../../../../shared/components/confirm-modal/confirm-modal.component';

@Component({
  selector: 'app-spaces-list',
  standalone: true,
  imports: [CommonModule, FormsModule, AppCardComponent],
  template: `
    <div class="page-container">
      <!-- Header / Action bar -->
      <div class="page-header">
        <div>
          <h1 class="page-title">I Tuoi Spazi Verdi</h1>
          <p class="page-subtitle">
            Gestisci appartamenti, ville, terrazzi o giardini in cui coltivi le tue piante.
          </p>
        </div>
        <button type="button" class="btn btn-primary" (click)="openCreateModal()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>Nuovo Spazio</span>
        </button>
      </div>

      <!-- Search & Filters -->
      <div class="filters-bar">
        <div class="search-box">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            class="search-input"
            placeholder="Cerca spazio o città..."
            [(ngModel)]="searchQuery"
          />
        </div>
      </div>

      <!-- Spaces Grid -->
      @if (loading()) {
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Caricamento spazi verdi...</p>
        </div>
      } @else if (filteredSpaces().length === 0) {
        <div class="empty-state glass-panel">
          <div class="empty-icon">🏡</div>
          <h3>Nessuno spazio verde trovato</h3>
          <p>Inizia aggiungendo la tua casa, il balcone o il giardino per organizzare le tue piante.</p>
          <button type="button" class="btn btn-primary" (click)="openCreateModal()">
            Crea il primo Spazio
          </button>
        </div>
      } @else {
        <div class="grid-layout">
          @for (space of filteredSpaces(); track space.id) {
            <app-card
              [title]="space.name"
              [description]="space.description"
              [imageUrl]="space.coverPhotoUrl"
              [statusBadge]="(space.rooms?.length || 0) + ' ' + ((space.rooms?.length === 1) ? 'Stanza' : 'Stanze')"
              [statusVariant]="'default'"
              [mapLink]="getMapLink(space.location)"
              [showActions]="true"
              (cardClick)="navigateToSpace(space.id)"
              (edit)="openEditModal(space)"
              (delete)="confirmDeleteSpace(space)"
            />
          }
        </div>
      }

      <!-- Create / Edit Space Modal -->
      @if (showModal()) {
        <div class="modal-backdrop" (click)="closeModal()">
          <div class="glass-modal modal-card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h2>{{ isEditing() ? 'Modifica Spazio' : 'Nuovo Spazio Verde' }}</h2>
              <button type="button" class="icon-close" (click)="closeModal()">✕</button>
            </div>

            <form (ngSubmit)="saveSpace()">
              <div class="form-group">
                <label>Nome Spazio *</label>
                <input
                  type="text"
                  class="input-field"
                  placeholder="Es: Casa Principale, Casa al mare, Terrazzo Nord"
                  [(ngModel)]="formData.name"
                  name="name"
                  required
                />
              </div>

              <div class="form-group">
                <label>Posizione / Indirizzo (Opzionale)</label>
                <input
                  type="text"
                  class="input-field"
                  placeholder="Es: Milano, Via dei Giardini 10"
                  [(ngModel)]="formData.location"
                  name="location"
                />
              </div>

              <div class="form-group">
                <label>Descrizione (Opzionale)</label>
                <textarea
                  class="input-field textarea"
                  rows="3"
                  placeholder="Note, esposizione generale o clima dello spazio..."
                  [(ngModel)]="formData.description"
                  name="description"
                ></textarea>
              </div>

              <div class="form-group">
                <label>Foto di Copertina</label>
                <div class="photo-upload-row">
                  @if (formData.coverPhotoUrl) {
                    <div class="preview-wrap">
                      <img [src]="formData.coverPhotoUrl" alt="Copertina" class="preview-img" />
                      <button type="button" class="btn-remove-photo" (click)="formData.coverPhotoUrl = null">✕</button>
                    </div>
                  }
                  <input
                    type="file"
                    #fileInput
                    accept="image/*"
                    style="display: none"
                    (change)="onFileSelected($event)"
                  />
                  <button
                    type="button"
                    class="btn btn-outline"
                    [disabled]="uploadingPhoto()"
                    (click)="fileInput.click()"
                  >
                    @if (uploadingPhoto()) {
                      <span>Caricamento in corso...</span>
                    } @else {
                      <span>{{ formData.coverPhotoUrl ? 'Cambia foto' : 'Carica foto' }}</span>
                    }
                  </button>
                </div>
              </div>

              <div class="modal-actions">
                <button type="button" class="btn btn-outline" (click)="closeModal()">
                  Annulla
                </button>
                <button
                  type="submit"
                  class="btn btn-primary"
                  [disabled]="!formData.name?.trim() || saving()"
                >
                  @if (saving()) {
                    <span>Salvataggio...</span>
                  } @else {
                    <span>{{ isEditing() ? 'Salva Modifiche' : 'Crea Spazio' }}</span>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
    }
    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1.5rem;
      margin-bottom: 2rem;
      flex-wrap: wrap;
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
    .filters-bar {
      margin-bottom: 2rem;
    }
    .search-box {
      position: relative;
      max-width: 420px;
      display: flex;
      align-items: center;
    }
    .search-box svg {
      position: absolute;
      left: 1rem;
      color: var(--text-muted);
      pointer-events: none;
    }
    .search-input {
      width: 100%;
      padding: 0.75rem 1rem 0.75rem 2.8rem;
      border-radius: var(--radius-full);
      border: 1px solid var(--border-subtle);
      background: var(--bg-surface);
      color: var(--text-main);
      font-size: 0.95rem;
      box-shadow: var(--shadow-sm);
      outline: none;
      transition: all 0.2s ease;
    }
    .search-input:focus {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px var(--color-primary-subtle);
    }
    .grid-layout {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.75rem;
    }
    .empty-state {
      padding: 4rem 2rem;
      text-align: center;
      max-width: 500px;
      margin: 2rem auto;
      border-radius: var(--radius-lg);
    }
    .empty-icon {
      font-size: 3.5rem;
      margin-bottom: 1rem;
    }
    .empty-state h3 {
      font-size: 1.35rem;
      color: var(--text-main);
      margin: 0 0 0.5rem 0;
    }
    .empty-state p {
      color: var(--text-muted);
      margin: 0 0 1.5rem 0;
      line-height: 1.5;
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
    /* Modal */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1000;
      background: rgba(10, 17, 14, 0.7);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .modal-card {
      max-width: 540px;
      width: 100%;
      padding: 2rem;
      border-radius: var(--radius-lg);
    }
    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.5rem;
    }
    .modal-header h2 {
      margin: 0;
      font-size: 1.4rem;
      color: var(--text-main);
    }
    .icon-close {
      background: none;
      border: none;
      font-size: 1.25rem;
      color: var(--text-muted);
      cursor: pointer;
    }
    .photo-upload-row {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .preview-wrap {
      position: relative;
      width: 72px;
      height: 72px;
      border-radius: var(--radius-md);
      overflow: hidden;
    }
    .preview-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .btn-remove-photo {
      position: absolute;
      top: 2px;
      right: 2px;
      background: rgba(0, 0, 0, 0.6);
      color: #fff;
      border: none;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 0.75rem;
    }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 1.5rem;
    }
  `],
})
export class SpacesListComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly mapProvider = inject(MapProviderService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);

  readonly spaces = signal<SpaceItem[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly uploadingPhoto = signal(false);

  readonly showModal = signal(false);
  readonly isEditing = signal(false);
  currentEditingId: string | null = null;

  searchQuery = '';
  userSettings: UserSettings | null = null;

  formData: {
    name: string;
    location: string;
    description: string;
    coverPhotoUrl: string | null;
  } = {
    name: '',
    location: '',
    description: '',
    coverPhotoUrl: null,
  };

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading.set(true);
    this.api.getSettings().subscribe({
      next: (s) => (this.userSettings = s),
    });

    this.api.getSpaces().subscribe({
      next: (spaces) => {
        this.spaces.set(spaces);
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Errore nel caricamento degli spazi');
        this.loading.set(false);
      },
    });
  }

  filteredSpaces(): SpaceItem[] {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) return this.spaces();
    return this.spaces().filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.location && s.location.toLowerCase().includes(q)) ||
        (s.description && s.description.toLowerCase().includes(q)),
    );
  }

  getMapLink(location?: string | null): string | null {
    if (!location?.trim()) return null;
    return this.mapProvider.getMapUrl(
      location,
      this.userSettings?.preferredMapProvider || 'osm',
    );
  }

  navigateToSpace(id: string) {
    this.router.navigate(['/spaces', id]);
  }

  openCreateModal() {
    this.isEditing.set(false);
    this.currentEditingId = null;
    this.formData = {
      name: '',
      location: '',
      description: '',
      coverPhotoUrl: null,
    };
    this.showModal.set(true);
  }

  openEditModal(space: SpaceItem) {
    this.isEditing.set(true);
    this.currentEditingId = space.id;
    this.formData = {
      name: space.name,
      location: space.location || '',
      description: space.description || '',
      coverPhotoUrl: space.coverPhotoUrl || null,
    };
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    input.value = '';

    this.uploadingPhoto.set(true);
    const metadata = this.currentEditingId ? { spaceId: this.currentEditingId } : undefined;
    this.api.uploadAttachment(file, metadata).subscribe({
      next: (att: any) => {
        this.formData.coverPhotoUrl = `/api/attachments/${att.id}/preview`;
        this.uploadingPhoto.set(false);
        this.toast.success('Foto caricata con successo');
      },
      error: () => {
        this.uploadingPhoto.set(false);
        this.toast.error('Errore durante il caricamento della foto');
      },
    });
  }

  saveSpace() {
    if (!this.formData.name.trim()) return;

    this.saving.set(true);
    const payload: Partial<SpaceItem> = {
      name: this.formData.name.trim(),
      location: this.formData.location.trim() || null,
      description: this.formData.description.trim() || null,
      coverPhotoUrl: this.formData.coverPhotoUrl,
    };

    if (this.isEditing() && this.currentEditingId) {
      this.api.updateSpace(this.currentEditingId, payload).subscribe({
        next: (updated) => {
          this.spaces.update((list) =>
            list.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)),
          );
          this.toast.success('Spazio aggiornato');
          this.saving.set(false);
          this.closeModal();
        },
        error: () => {
          this.toast.error('Errore durante l’aggiornamento dello spazio');
          this.saving.set(false);
        },
      });
    } else {
      this.api.createSpace(payload).subscribe({
        next: (created) => {
          this.spaces.update((list) => [created, ...list]);
          this.toast.success('Nuovo spazio creato con successo');
          this.saving.set(false);
          this.closeModal();
        },
        error: () => {
          this.toast.error('Errore durante la creazione dello spazio');
          this.saving.set(false);
        },
      });
    }
  }

  confirmDeleteSpace(space: SpaceItem) {
    const dialogRef = this.dialog.open<boolean>(ConfirmModalComponent, {
      data: {
        title: `Elimina "${space.name}"?`,
        message:
          'Sei sicuro di voler eliminare questo spazio verde? Tutte le stanze contenute verranno rimosse, ma le piante rimarranno salvate nel tuo Catalogo Piante.',
        confirmLabel: 'Elimina Spazio',
        confirmVariant: 'danger',
      },
    });

    dialogRef.closed.subscribe((confirmed) => {
      if (confirmed) {
        this.api.deleteSpace(space.id).subscribe({
          next: () => {
            this.spaces.update((list) => list.filter((s) => s.id !== space.id));
            this.toast.success('Spazio eliminato');
          },
          error: () => {
            this.toast.error('Errore durante l’eliminazione dello spazio');
          },
        });
      }
    });
  }
}

