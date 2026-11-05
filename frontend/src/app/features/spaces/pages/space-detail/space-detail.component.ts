import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { ApiService } from '../../../../core/api.service';
import { MapProviderService } from '../../../../core/map-provider.service';
import { ToastService } from '../../../../core/toast.service';
import { RoomItem, SpaceItem, UserSettings } from '../../../../core/models';
import { AppCardComponent } from '../../../../shared/components/app-card/app-card.component';
import { ConfirmModalComponent } from '../../../../shared/components/confirm-modal/confirm-modal.component';

@Component({
  selector: 'app-space-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AppCardComponent],
  template: `
    <div class="page-container">
      <!-- Breadcrumbs -->
      <nav class="breadcrumbs">
        <a routerLink="/spaces" class="breadcrumb-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          <span>Tutti gli Spazi</span>
        </a>
        <span class="separator">/</span>
        <span class="current">{{ space()?.name || 'Spazio' }}</span>
      </nav>

      @if (loading()) {
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Caricamento spazio...</p>
        </div>
      } @else if (space(); as sp) {
        <!-- Space Hero Banner -->
        <div class="glass-panel space-hero">
          @if (sp.coverPhotoUrl) {
            <div class="hero-image-wrap">
              <img [src]="sp.coverPhotoUrl" [alt]="sp.name" class="hero-img" />
            </div>
          }
          <div class="hero-content">
            <div class="hero-header">
              <div>
                <h1 class="hero-title">{{ sp.name }}</h1>
                @if (sp.location) {
                  <div class="hero-location">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                      <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    <span>{{ sp.location }}</span>
                    @if (getMapLink(sp.location); as mapUrl) {
                      <a [href]="mapUrl" target="_blank" rel="noopener noreferrer" class="map-pill">
                        Apri su {{ getMapProviderName() }} ↗
                      </a>
                    }
                  </div>
                }
              </div>
              <div class="hero-actions">
                <button type="button" class="btn btn-outline" (click)="openCreateRoomModal()">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  <span>Nuova Stanza</span>
                </button>
              </div>
            </div>

            @if (sp.description) {
              <p class="hero-desc">{{ sp.description }}</p>
            }
          </div>
        </div>

        <!-- Rooms Section -->
        <div class="section-container">
          <div class="section-header">
            <h2>Stanze e Ambienti ({{ rooms().length }})</h2>
          </div>

          @if (rooms().length === 0) {
            <div class="empty-state glass-panel">
              <div class="empty-icon">🪴</div>
              <h3>Nessuna stanza in questo spazio</h3>
              <p>Aggiungi le stanze della casa (es: Salotto, Balcone, Camera da letto) per iniziare a collocare le tue piante.</p>
              <button type="button" class="btn btn-primary" (click)="openCreateRoomModal()">
                Crea Stanza
              </button>
            </div>
          } @else {
            <div class="grid-layout">
              @for (room of rooms(); track room.id) {
                <app-card
                  [title]="room.name"
                  [description]="room.description"
                  [imageUrl]="room.coverPhotoUrl"
                  [statusBadge]="(room.roomPlants?.length || 0) + ' ' + ((room.roomPlants?.length === 1) ? 'Pianta' : 'Piante')"
                  [statusVariant]="'default'"
                  [showActions]="true"
                  (cardClick)="navigateToRoom(room.id)"
                  (edit)="openEditRoomModal(room)"
                  (delete)="confirmDeleteRoom(room)"
                />
              }
            </div>
          }
        </div>
      }

      <!-- Create / Edit Room Modal -->
      @if (showRoomModal()) {
        <div class="modal-backdrop" (click)="closeRoomModal()">
          <div class="glass-modal modal-card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h2>{{ isEditingRoom() ? 'Modifica Stanza' : 'Nuova Stanza' }}</h2>
              <button type="button" class="icon-close" (click)="closeRoomModal()">✕</button>
            </div>

            <form (ngSubmit)="saveRoom()">
              <div class="form-group">
                <label>Nome Stanza *</label>
                <input
                  type="text"
                  class="input-field"
                  placeholder="Es: Salotto con bovindo, Balcone esposto a Sud"
                  [(ngModel)]="roomFormData.name"
                  name="name"
                  required
                />
              </div>

              <div class="form-group">
                <label>Descrizione / Esposizione (Opzionale)</label>
                <textarea
                  class="input-field textarea"
                  rows="3"
                  placeholder="Dettagli su umidità, riscaldamento, correnti d'aria..."
                  [(ngModel)]="roomFormData.description"
                  name="description"
                ></textarea>
              </div>

              <div class="form-group">
                <label>Foto Ambiente</label>
                <div class="photo-upload-row">
                  @if (roomFormData.coverPhotoUrl) {
                    <div class="preview-wrap">
                      <img [src]="roomFormData.coverPhotoUrl" alt="Copertina" class="preview-img" />
                      <button type="button" class="btn-remove-photo" (click)="roomFormData.coverPhotoUrl = null">✕</button>
                    </div>
                  }
                  <input
                    type="file"
                    #roomFileInput
                    accept="image/*"
                    style="display: none"
                    (change)="onRoomFileSelected($event)"
                  />
                  <button
                    type="button"
                    class="btn btn-outline"
                    [disabled]="uploadingRoomPhoto()"
                    (click)="roomFileInput.click()"
                  >
                    @if (uploadingRoomPhoto()) {
                      <span>Caricamento in corso...</span>
                    } @else {
                      <span>{{ roomFormData.coverPhotoUrl ? 'Cambia foto' : 'Carica foto' }}</span>
                    }
                  </button>
                </div>
              </div>

              <div class="modal-actions">
                <button type="button" class="btn btn-outline" (click)="closeRoomModal()">
                  Annulla
                </button>
                <button
                  type="submit"
                  class="btn btn-primary"
                  [disabled]="!roomFormData.name?.trim() || savingRoom()"
                >
                  @if (savingRoom()) {
                    <span>Salvataggio...</span>
                  } @else {
                    <span>{{ isEditingRoom() ? 'Salva Modifiche' : 'Crea Stanza' }}</span>
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
    .breadcrumbs {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1.5rem;
      font-size: 0.92rem;
      color: var(--text-muted);
    }
    .breadcrumb-link {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      color: var(--color-primary);
      text-decoration: none;
      font-weight: 500;
    }
    .breadcrumb-link:hover {
      text-decoration: underline;
    }
    .separator {
      opacity: 0.5;
    }
    .space-hero {
      padding: 2rem;
      margin-bottom: 2.5rem;
      display: flex;
      gap: 2rem;
      align-items: center;
      border-radius: var(--radius-lg);
    }
    .hero-image-wrap {
      width: 180px;
      height: 140px;
      border-radius: var(--radius-md);
      overflow: hidden;
      flex-shrink: 0;
    }
    .hero-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .hero-content {
      flex: 1;
    }
    .hero-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1.5rem;
      flex-wrap: wrap;
    }
    .hero-title {
      font-size: 2.2rem;
      font-weight: 800;
      color: var(--text-main);
      margin: 0 0 0.5rem 0;
      letter-spacing: -0.02em;
    }
    .hero-location {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.95rem;
      color: var(--text-secondary);
      flex-wrap: wrap;
    }
    .map-pill {
      font-size: 0.8rem;
      padding: 0.2rem 0.6rem;
      background: var(--color-primary-subtle);
      color: var(--color-primary);
      border-radius: var(--radius-full);
      text-decoration: none;
      font-weight: 600;
    }
    .hero-desc {
      margin: 1rem 0 0 0;
      color: var(--text-muted);
      line-height: 1.5;
    }
    .section-container {
      margin-top: 2rem;
    }
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.5rem;
    }
    .section-header h2 {
      margin: 0;
      font-size: 1.4rem;
      color: var(--text-main);
    }
    .grid-layout {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.75rem;
    }
    .empty-state {
      padding: 3.5rem 2rem;
      text-align: center;
      max-width: 480px;
      margin: 2rem auto;
      border-radius: var(--radius-lg);
    }
    .empty-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }
    .empty-state h3 {
      font-size: 1.25rem;
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
      max-width: 520px;
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
      font-size: 1.35rem;
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
    @media (max-width: 640px) {
      .space-hero {
        flex-direction: column;
        align-items: flex-start;
      }
      .hero-image-wrap {
        width: 100%;
        height: 180px;
      }
    }
  `],
})
export class SpaceDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly mapProvider = inject(MapProviderService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(Dialog);

  spaceId!: string;
  readonly space = signal<SpaceItem | null>(null);
  readonly rooms = signal<RoomItem[]>([]);
  readonly loading = signal(true);

  readonly showRoomModal = signal(false);
  readonly isEditingRoom = signal(false);
  readonly savingRoom = signal(false);
  readonly uploadingRoomPhoto = signal(false);
  currentEditingRoomId: string | null = null;

  userSettings: UserSettings | null = null;

  roomFormData: {
    name: string;
    description: string;
    coverPhotoUrl: string | null;
  } = {
    name: '',
    description: '',
    coverPhotoUrl: null,
  };

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      this.spaceId = params.get('id')!;
      if (this.spaceId) {
        this.loadData();
      }
    });
  }

  loadData() {
    this.loading.set(true);
    this.api.getSettings().subscribe({
      next: (s) => (this.userSettings = s),
    });

    this.api.getSpace(this.spaceId).subscribe({
      next: (sp) => {
        this.space.set(sp);
        this.loadRooms();
      },
      error: () => {
        this.toast.error('Spazio non trovato');
        this.loading.set(false);
        this.router.navigate(['/spaces']);
      },
    });
  }

  loadRooms() {
    this.api.getRooms(this.spaceId).subscribe({
      next: (rooms) => {
        this.rooms.set(rooms);
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Errore nel caricamento delle stanze');
        this.loading.set(false);
      },
    });
  }

  getMapLink(location?: string | null): string | null {
    if (!location?.trim()) return null;
    return this.mapProvider.getMapUrl(
      location,
      this.userSettings?.preferredMapProvider || 'osm',
    );
  }

  getMapProviderName(): string {
    return this.mapProvider.getProviderName(
      this.userSettings?.preferredMapProvider || 'osm',
    );
  }

  navigateToRoom(roomId: string) {
    this.router.navigate(['/spaces', this.spaceId, 'rooms', roomId]);
  }

  openCreateRoomModal() {
    this.isEditingRoom.set(false);
    this.currentEditingRoomId = null;
    this.roomFormData = {
      name: '',
      description: '',
      coverPhotoUrl: null,
    };
    this.showRoomModal.set(true);
  }

  openEditRoomModal(room: RoomItem) {
    this.isEditingRoom.set(true);
    this.currentEditingRoomId = room.id;
    this.roomFormData = {
      name: room.name,
      description: room.description || '',
      coverPhotoUrl: room.coverPhotoUrl || null,
    };
    this.showRoomModal.set(true);
  }

  closeRoomModal() {
    this.showRoomModal.set(false);
  }

  onRoomFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    input.value = '';

    this.uploadingRoomPhoto.set(true);
    this.api.uploadAttachment(file, { spaceId: this.spaceId }).subscribe({
      next: (att: any) => {
        this.roomFormData.coverPhotoUrl = `/api/attachments/${att.id}/preview`;
        this.uploadingRoomPhoto.set(false);
        this.toast.success('Foto caricata con successo');
      },
      error: () => {
        this.uploadingRoomPhoto.set(false);
        this.toast.error('Errore caricamento foto');
      },
    });
  }

  saveRoom() {
    if (!this.roomFormData.name.trim()) return;

    this.savingRoom.set(true);
    const payload: Partial<RoomItem> = {
      spaceId: this.spaceId,
      name: this.roomFormData.name.trim(),
      description: this.roomFormData.description.trim() || null,
      coverPhotoUrl: this.roomFormData.coverPhotoUrl,
    };

    if (this.isEditingRoom() && this.currentEditingRoomId) {
      this.api.updateRoom(this.currentEditingRoomId, payload).subscribe({
        next: (updated) => {
          this.rooms.update((list) =>
            list.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)),
          );
          this.toast.success('Stanza aggiornata');
          this.savingRoom.set(false);
          this.closeRoomModal();
        },
        error: () => {
          this.toast.error('Errore aggiornamento stanza');
          this.savingRoom.set(false);
        },
      });
    } else {
      this.api.createRoom(payload).subscribe({
        next: (created) => {
          this.rooms.update((list) => [...list, created]);
          this.toast.success('Nuova stanza creata');
          this.savingRoom.set(false);
          this.closeRoomModal();
        },
        error: () => {
          this.toast.error('Errore creazione stanza');
          this.savingRoom.set(false);
        },
      });
    }
  }

  confirmDeleteRoom(room: RoomItem) {
    const dialogRef = this.dialog.open<boolean>(ConfirmModalComponent, {
      data: {
        title: `Elimina stanza "${room.name}"?`,
        message:
          'Sei sicuro di voler eliminare questa stanza? Le piante collocate qui verranno rimosse dall’ambiente, ma rimarranno intatte nel tuo Catalogo Piante.',
        confirmLabel: 'Elimina Stanza',
        confirmVariant: 'danger',
      },
    });

    dialogRef.closed.subscribe((confirmed) => {
      if (confirmed) {
        this.api.deleteRoom(room.id).subscribe({
          next: () => {
            this.rooms.update((list) => list.filter((r) => r.id !== room.id));
            this.toast.success('Stanza eliminata');
          },
          error: () => {
            this.toast.error('Errore eliminazione stanza');
          },
        });
      }
    });
  }
}

