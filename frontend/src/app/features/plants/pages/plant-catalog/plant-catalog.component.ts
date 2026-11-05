import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { firstValueFrom } from 'rxjs';
import { OfflineStorageService } from '../../../../core/offline-storage.service';
import { SyncService } from '../../../../core/sync.service';
import { ToastService } from '../../../../core/toast.service';
import { PlantItem } from '../../../../core/models';
import { AppCardComponent } from '../../../../shared/components/app-card/app-card.component';
import { ConfirmModalComponent } from '../../../../shared/components/confirm-modal/confirm-modal.component';
import { AddToRoomModalComponent } from '../../../../shared/components/add-to-room-modal/add-to-room-modal.component';

@Component({
  selector: 'app-plant-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule, AppCardComponent],
  template: `
    <div class="page-container">
      <!-- Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Catalogo Piante</h1>
          <p class="page-subtitle">
            Il tuo erbario personale con schede botaniche, consigli stagionali e requisiti di cura.
          </p>
        </div>
        <button type="button" class="btn btn-primary" (click)="navigateToCreate()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>Nuova Pianta</span>
        </button>
      </div>

      <!-- Filters & Search -->
      <div class="filters-bar">
        <div class="search-box">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            class="search-input"
            placeholder="Cerca per nome comune o botanico (es: Monstera, Ficus, Orchidea)..."
            [(ngModel)]="searchQuery"
          />
        </div>
      </div>

      <!-- Catalog Grid -->
      @if (loading()) {
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Caricamento catalogo...</p>
        </div>
      } @else if (filteredPlants().length === 0) {
        <div class="empty-state glass-panel">
          <div class="empty-icon">🪴</div>
          <h3>Nessuna pianta trovata nel catalogo</h3>
          <p>Aggiungi la prima pianta per compilare la sua scheda botanica e iniziare a curarla.</p>
          <button type="button" class="btn btn-primary" (click)="navigateToCreate()">
            Aggiungi la prima Pianta
          </button>
        </div>
      } @else {
        <div class="grid-layout">
          @for (plant of filteredPlants(); track plant.id) {
            <app-card
              [title]="plant.commonName"
              [subtitle]="plant.scientificName"
              [imageUrl]="getPlantCoverUrl(plant)"
              [statusBadge]="getInstanceBadge(plant)"
              [statusVariant]="plant.roomPlants?.length ? 'success' : 'default'"
              [showActions]="true"
              [quickActionLabel]="'Colloca in stanza'"
              [quickActionIcon]="'plus'"
              [quickActionVariant]="'secondary'"
              (cardClick)="navigateToDetail(plant.id)"
              (quickAction)="openAddToRoom(plant)"
              (edit)="navigateToEdit(plant.id)"
              (delete)="confirmDeletePlant(plant)"
            />
          }
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
      max-width: 500px;
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
      grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
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
  `],
})
export class PlantCatalogComponent implements OnInit {
  private readonly storage = inject(OfflineStorageService);
  private readonly syncService = inject(SyncService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);

  readonly plants = signal<PlantItem[]>([]);
  readonly loading = signal(true);
  searchQuery = '';
  private initialLoaded = false;

  constructor() {
    effect(() => {
      this.syncService.dataUpdated();
      void this.loadPlants();
    });
  }

  ngOnInit() {
    void this.loadPlants();
  }

  async loadPlants() {
    try {
      const list = await this.storage.getAllPlants();
      const allRoomPlants = await this.storage.getAllRoomPlants();

      for (const p of list) {
        p.roomPlants = allRoomPlants.filter((rp) => rp.plantId === p.id);
      }

      this.plants.set(list);

      if (list.length === 0 && !this.initialLoaded && !this.syncService.checkIsOffline()) {
        this.initialLoaded = true;
        await this.syncService.sync(true);
      }
    } catch {
      // Local storage read error
    } finally {
      this.loading.set(false);
    }
  }

  filteredPlants(): PlantItem[] {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) return this.plants();
    return this.plants().filter(
      (p) =>
        p.commonName.toLowerCase().includes(q) ||
        (p.scientificName && p.scientificName.toLowerCase().includes(q)),
    );
  }

  getPlantCoverUrl(plant: PlantItem): string | null {
    if (plant.attachments?.length) {
      return `/api/attachments/${plant.attachments[0].id}/preview`;
    }
    return null;
  }

  getInstanceBadge(plant: PlantItem): string {
    const count = plant.roomPlants?.length || 0;
    if (count === 0) return 'Non collocata';
    return count === 1 ? '1 stanza' : `${count} stanze`;
  }

  navigateToCreate() {
    this.router.navigate(['/plants', 'new']);
  }

  navigateToDetail(id: string) {
    this.router.navigate(['/plants', id]);
  }

  navigateToEdit(id: string) {
    this.router.navigate(['/plants', id, 'edit']);
  }

  openAddToRoom(plant: PlantItem) {
    const dialogRef = this.dialog.open(AddToRoomModalComponent, {
      data: {
        plantId: plant.id,
        plantName: plant.commonName,
      },
    });

    dialogRef.closed.subscribe((result) => {
      if (result) {
        void this.loadPlants();
      }
    });
  }

  async confirmDeletePlant(plant: PlantItem) {
    const dialogRef = this.dialog.open<boolean>(ConfirmModalComponent, {
      data: {
        title: `Eliminare "${plant.commonName}" dal catalogo?`,
        message:
          'Se elimini questa pianta dal catalogo, verranno rimossi anche gli esemplari collocati nelle stanze e lo storico delle innaffiature. Vuoi procedere?',
        confirmLabel: 'Elimina Pianta',
        confirmVariant: 'danger',
      },
    });

    const confirmed = await firstValueFrom(dialogRef.closed);
    if (confirmed) {
      await this.storage.removePlants([plant.id]);
      const rps = await this.storage.getRoomPlantsByPlant(plant.id);
      if (rps.length) {
        await this.storage.removeRoomPlants(rps.map((p) => p.id));
      }
      await this.syncService.queuePlantChange(plant.id, 'delete');
      this.toast.success('Pianta eliminata dal catalogo');
    }
  }
}

