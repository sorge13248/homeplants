import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { firstValueFrom } from 'rxjs';
import { OfflineStorageService } from '../../../../core/offline-storage.service';
import { SyncService } from '../../../../core/sync.service';
import { ToastService } from '../../../../core/toast.service';
import { PlantItem } from '../../../../core/models';
import { SeasonTabsComponent } from '../../../../shared/components/season-tabs/season-tabs.component';
import { ConfirmModalComponent } from '../../../../shared/components/confirm-modal/confirm-modal.component';
import { AddToRoomModalComponent } from '../../../../shared/components/add-to-room-modal/add-to-room-modal.component';

@Component({
  selector: 'app-plant-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, SeasonTabsComponent],
  template: `
    <div class="page-container">
      <!-- Breadcrumbs -->
      <nav class="breadcrumbs">
        <a routerLink="/plants" class="breadcrumb-link">Catalogo Piante</a>
        <span class="separator">/</span>
        <span class="current">{{ plant()?.commonName || 'Dettaglio Pianta' }}</span>
      </nav>

      @if (loading()) {
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Caricamento scheda botanica...</p>
        </div>
      } @else if (plant(); as pl) {
        <div class="sheet-layout">
          <!-- Left Column: Gallery & Quick Actions -->
          <div class="gallery-column">
            <div class="glass-panel image-card">
              <div class="main-image-wrap">
                @if (selectedImageUrl || getCoverImage(pl)) {
                  <img
                    [src]="selectedImageUrl || getCoverImage(pl)"
                    [alt]="pl.commonName"
                    class="main-image"
                  />
                } @else {
                  <div class="placeholder-icon">🪴</div>
                }
              </div>

              <!-- Thumbnails row if multiple attachments -->
              @if (pl.attachments && pl.attachments.length > 1) {
                <div class="thumbnails-row">
                  @for (att of pl.attachments; track att.id) {
                    <button
                      type="button"
                      class="thumbnail-btn"
                      [class.active]="selectedImageUrl === ('/api/attachments/' + att.id + '/preview')"
                      (click)="selectedImageUrl = '/api/attachments/' + att.id + '/preview'"
                    >
                      <img [src]="'/api/attachments/' + att.id + '/preview'" alt="Miniatura" />
                    </button>
                  }
                </div>
              }
            </div>

            <!-- Active Rooms / Exemplars Widget -->
            <div class="glass-panel instances-card">
              <div class="card-title-row">
                <h3>Collocazioni Attive ({{ pl.roomPlants?.length || 0 }})</h3>
                <button type="button" class="btn btn-sm btn-outline" (click)="openAddToRoom(pl)">
                  + Colloca
                </button>
              </div>

              @if (!pl.roomPlants || pl.roomPlants.length === 0) {
                <p class="empty-text">Nessun esemplare di questa pianta è attualmente collocato in una stanza.</p>
              } @else {
                <div class="instances-list">
                  @for (rp of pl.roomPlants; track rp.id) {
                    <div class="instance-row">
                      <div class="instance-info">
                        <span class="room-title">{{ rp.room?.name || 'Stanza' }}</span>
                        @if (rp.position) {
                          <span class="pos-badge">{{ rp.position }}</span>
                        }
                      </div>
                      @if (rp.room?.spaceId && rp.room?.id) {
                        <a
                          [routerLink]="['/spaces', rp.room?.spaceId, 'rooms', rp.room?.id]"
                          class="link-go"
                        >
                          Vai alla stanza →
                        </a>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          </div>

          <!-- Right Column: Botanical Details & Tabs -->
          <div class="details-column">
            <!-- Header Banner -->
            <div class="glass-panel header-card">
              <div class="header-main">
                <div>
                  <h1 class="plant-title">{{ pl.commonName }}</h1>
                  @if (pl.scientificName) {
                    <div class="scientific-title">{{ pl.scientificName }}</div>
                  }
                </div>
                <div class="header-actions">
                  <button type="button" class="btn btn-outline" (click)="navigateToEdit(pl.id)">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                    <span>Modifica</span>
                  </button>
                  <button type="button" class="btn btn-danger-outline" (click)="confirmDelete(pl)">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <!-- Seasonal Care Tabs -->
            <div class="care-section">
              <h2 class="section-title">Calendario Cure Stagionali</h2>
              <app-season-tabs
                [seasonalCare]="pl.seasonalCare || null"
                [editMode]="false"
              />
            </div>

            <!-- Soil & Fertilization Specs -->
            <div class="specs-grid">
              <!-- Terriccio e Rinvaso -->
              <div class="glass-panel spec-box">
                <div class="spec-header">
                  <span class="spec-icon">🪴</span>
                  <h3>Terriccio & Rinvaso</h3>
                </div>
                <div class="spec-content">
                  <div class="spec-item">
                    <span class="label">Stagione rinvaso:</span>
                    <span class="val">{{ formatRepotSeason(pl.soilRepotting?.repottingSeason) }}</span>
                  </div>
                  @if (pl.soilRepotting?.potType) {
                    <div class="spec-item">
                      <span class="label">Vaso consigliato:</span>
                      <span class="val">{{ pl.soilRepotting?.potType }}</span>
                    </div>
                  }
                  @if (pl.soilRepotting?.soilType) {
                    <div class="spec-item">
                      <span class="label">Tipo terriccio:</span>
                      <span class="val">{{ pl.soilRepotting?.soilType }}</span>
                    </div>
                  }
                  @if (pl.soilRepotting?.composition) {
                    <div class="spec-item notes">
                      <span class="label">Composizione / Drenaggio:</span>
                      <p class="val-notes">{{ pl.soilRepotting?.composition }}</p>
                    </div>
                  }
                </div>
              </div>

              <!-- Concimazione -->
              <div class="glass-panel spec-box">
                <div class="spec-header">
                  <span class="spec-icon">🧪</span>
                  <h3>Concimazione & Nutrimento</h3>
                </div>
                <div class="spec-content">
                  @if (pl.fertilization?.period) {
                    <div class="spec-item">
                      <span class="label">Periodo:</span>
                      <span class="val">{{ pl.fertilization?.period }}</span>
                    </div>
                  }
                  @if (pl.fertilization?.frequencyDays) {
                    <div class="spec-item">
                      <span class="label">Frequenza:</span>
                      <span class="val">Ogni {{ pl.fertilization?.frequencyDays }} giorni</span>
                    </div>
                  }
                  @if (pl.fertilization?.fertilizerType) {
                    <div class="spec-item">
                      <span class="label">Tipo concime:</span>
                      <span class="val">{{ pl.fertilization?.fertilizerType }}</span>
                    </div>
                  }
                  @if (pl.fertilization?.notes) {
                    <div class="spec-item notes">
                      <span class="label">Consigli concimazione:</span>
                      <p class="val-notes">{{ pl.fertilization?.notes }}</p>
                    </div>
                  }
                </div>
              </div>
            </div>
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
    .sheet-layout {
      display: grid;
      grid-template-columns: 360px 1fr;
      gap: 2rem;
      align-items: start;
    }
    .gallery-column {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .image-card {
      padding: 1rem;
      border-radius: var(--radius-lg);
      overflow: hidden;
    }
    .main-image-wrap {
      width: 100%;
      height: 320px;
      border-radius: var(--radius-md);
      overflow: hidden;
      background: rgba(16, 185, 129, 0.08);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .main-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .placeholder-icon {
      font-size: 5rem;
    }
    .thumbnails-row {
      display: flex;
      gap: 0.6rem;
      margin-top: 0.75rem;
      overflow-x: auto;
      padding-bottom: 0.25rem;
    }
    .thumbnail-btn {
      width: 60px;
      height: 60px;
      border-radius: var(--radius-sm);
      overflow: hidden;
      border: 2px solid transparent;
      padding: 0;
      background: none;
      cursor: pointer;
      flex-shrink: 0;
    }
    .thumbnail-btn.active {
      border-color: var(--color-primary);
    }
    .thumbnail-btn img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .instances-card {
      padding: 1.5rem;
      border-radius: var(--radius-lg);
    }
    .card-title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
    }
    .card-title-row h3 {
      margin: 0;
      font-size: 1.1rem;
      color: var(--text-main);
    }
    .empty-text {
      color: var(--text-muted);
      font-size: 0.88rem;
      line-height: 1.45;
      margin: 0;
    }
    .instances-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .instance-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.6rem 0.8rem;
      background: var(--bg-surface-translucent);
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-subtle);
    }
    .instance-info {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }
    .room-title {
      font-weight: 600;
      color: var(--text-main);
      font-size: 0.9rem;
    }
    .pos-badge {
      font-size: 0.78rem;
      color: var(--color-primary);
    }
    .link-go {
      font-size: 0.82rem;
      color: var(--color-primary);
      text-decoration: none;
      font-weight: 600;
    }
    .details-column {
      display: flex;
      flex-direction: column;
      gap: 1.75rem;
    }
    .header-card {
      padding: 1.75rem 2rem;
      border-radius: var(--radius-lg);
    }
    .header-main {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1.5rem;
    }
    .plant-title {
      margin: 0;
      font-size: 2.3rem;
      font-weight: 800;
      color: var(--text-main);
      letter-spacing: -0.02em;
    }
    .scientific-title {
      font-size: 1.1rem;
      color: var(--text-muted);
      font-style: italic;
      margin-top: 0.25rem;
    }
    .header-actions {
      display: flex;
      gap: 0.6rem;
    }
    .btn-danger-outline {
      border: 1px solid rgba(239, 68, 68, 0.4);
      background: none;
      color: var(--color-danger);
      padding: 0.6rem;
      border-radius: var(--radius-md);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .btn-danger-outline:hover {
      background: rgba(239, 68, 68, 0.1);
      border-color: var(--color-danger);
    }
    .section-title {
      font-size: 1.35rem;
      font-weight: 700;
      color: var(--text-main);
      margin: 0 0 1rem 0;
    }
    .specs-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
    }
    .spec-box {
      padding: 1.5rem;
      border-radius: var(--radius-lg);
    }
    .spec-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1.25rem;
    }
    .spec-icon {
      font-size: 1.3rem;
    }
    .spec-header h3 {
      margin: 0;
      font-size: 1.15rem;
      color: var(--text-main);
    }
    .spec-content {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .spec-item {
      display: flex;
      justify-content: space-between;
      font-size: 0.9rem;
    }
    .spec-item .label {
      color: var(--text-muted);
    }
    .spec-item .val {
      font-weight: 600;
      color: var(--text-main);
      text-align: right;
    }
    .spec-item.notes {
      flex-direction: column;
      gap: 0.35rem;
    }
    .val-notes {
      margin: 0;
      color: var(--text-secondary);
      font-size: 0.88rem;
      line-height: 1.45;
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
    @media (max-width: 860px) {
      .sheet-layout {
        grid-template-columns: 1fr;
      }
      .specs-grid {
        grid-template-columns: 1fr;
      }
    }
  `],
})
export class PlantDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly storage = inject(OfflineStorageService);
  private readonly syncService = inject(SyncService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(Dialog);

  plantId!: string;
  readonly plant = signal<PlantItem | null>(null);
  readonly loading = signal(true);
  selectedImageUrl: string | null = null;
  private initialLoaded = false;

  constructor() {
    effect(() => {
      this.syncService.dataUpdated();
      if (this.plantId) {
        void this.loadPlant();
      }
    });
  }

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      this.plantId = params.get('id')!;
      if (this.plantId) {
        void this.loadPlant();
      }
    });
  }

  async loadPlant() {
    try {
      const pl = await this.storage.getPlant(this.plantId);
      if (pl) {
        const rps = await this.storage.getRoomPlantsByPlant(this.plantId);
        const allRooms = await this.storage.getAllRooms();
        const allSpaces = await this.storage.getAllSpaces();

        for (const rp of rps) {
          rp.room = allRooms.find((r) => r.id === rp.roomId);
          if (rp.room) {
            rp.room.space = allSpaces.find((s) => s.id === rp.room!.spaceId);
          }
        }
        pl.roomPlants = rps;
        this.plant.set(pl);
        this.loading.set(false);
        return;
      }

      if (!this.initialLoaded && !this.syncService.checkIsOffline()) {
        this.initialLoaded = true;
        await this.syncService.sync(true);
        const refreshedPl = await this.storage.getPlant(this.plantId);
        if (refreshedPl) {
          const rps = await this.storage.getRoomPlantsByPlant(this.plantId);
          refreshedPl.roomPlants = rps;
          this.plant.set(refreshedPl);
          this.loading.set(false);
          return;
        }
      }

      this.toast.error('Pianta non trovata');
      this.router.navigate(['/plants']);
    } catch {
      // Local storage read error
    } finally {
      this.loading.set(false);
    }
  }

  getCoverImage(pl: PlantItem): string | null {
    if (pl.attachments?.length) {
      return `/api/attachments/${pl.attachments[0].id}/preview`;
    }
    return null;
  }

  formatRepotSeason(season?: string | null): string {
    switch (season) {
      case 'spring':
        return '🌸 Primavera';
      case 'summer':
        return '☀️ Estate';
      case 'autumn':
        return '🍂 Autunno';
      case 'winter':
        return '❄️ Inverno';
      case 'any':
        return 'Qualsiasi stagione';
      default:
        return 'Non specificata';
    }
  }

  openAddToRoom(pl: PlantItem) {
    const dialogRef = this.dialog.open(AddToRoomModalComponent, {
      data: {
        plantId: pl.id,
        plantName: pl.commonName,
      },
    });

    dialogRef.closed.subscribe((result) => {
      if (result) {
        void this.loadPlant();
      }
    });
  }

  navigateToEdit(id: string) {
    this.router.navigate(['/plants', id, 'edit']);
  }

  async confirmDelete(pl: PlantItem) {
    const dialogRef = this.dialog.open<boolean>(ConfirmModalComponent, {
      data: {
        title: `Eliminare "${pl.commonName}" dal catalogo?`,
        message:
          'Questa azione rimuoverà la scheda botanica e tutti gli esemplari presenti nelle stanze. Confermi l’eliminazione?',
        confirmLabel: 'Elimina Pianta',
        confirmVariant: 'danger',
      },
    });

    const confirmed = await firstValueFrom(dialogRef.closed);
    if (confirmed) {
      await this.storage.removePlants([pl.id]);
      const rps = await this.storage.getRoomPlantsByPlant(pl.id);
      if (rps.length) {
        await this.storage.removeRoomPlants(rps.map((p) => p.id));
      }
      await this.syncService.queuePlantChange(pl.id, 'delete');
      this.toast.success('Pianta eliminata dal catalogo');
      this.router.navigate(['/plants']);
    }
  }
}

