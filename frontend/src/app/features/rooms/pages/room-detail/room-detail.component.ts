import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { firstValueFrom } from 'rxjs';
import { OfflineStorageService } from '../../../../core/offline-storage.service';
import { SyncService } from '../../../../core/sync.service';
import { ToastService } from '../../../../core/toast.service';
import { RoomItem, RoomPlantItem, SpaceItem, WateringLogItem } from '../../../../core/models';
import { computeNextWateringDate, getWateringFrequencyDays } from '../../../../core/watering.utils';
import { ConfirmModalComponent } from '../../../../shared/components/confirm-modal/confirm-modal.component';
import { AddToRoomModalComponent } from '../../../../shared/components/add-to-room-modal/add-to-room-modal.component';

@Component({
  selector: 'app-room-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page-container">
      <!-- Breadcrumbs -->
      <nav class="breadcrumbs">
        <a routerLink="/spaces" class="breadcrumb-link">Spazi</a>
        <span class="separator">/</span>
        <a [routerLink]="['/spaces', spaceId]" class="breadcrumb-link">{{ space()?.name || 'Spazio' }}</a>
        <span class="separator">/</span>
        <span class="current">{{ room()?.name || 'Stanza' }}</span>
      </nav>

      @if (loading()) {
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Caricamento stanza...</p>
        </div>
      } @else if (room(); as rm) {
        <!-- Room Banner -->
        <div class="glass-panel room-hero">
          @if (rm.coverPhotoUrl) {
            <div class="hero-image-wrap">
              <img [src]="rm.coverPhotoUrl" [alt]="rm.name" class="hero-img" />
            </div>
          }
          <div class="hero-content">
            <div class="hero-header">
              <div>
                <h1 class="hero-title">{{ rm.name }}</h1>
                @if (rm.description) {
                  <p class="hero-desc">{{ rm.description }}</p>
                }
              </div>
              <div class="hero-actions">
                <button
                  type="button"
                  class="btn btn-outline"
                  [disabled]="roomPlants().length === 0"
                  (click)="confirmWaterAll()"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
                  </svg>
                  <span>Innaffia Tutte</span>
                </button>
                <button type="button" class="btn btn-primary" (click)="openAddToRoomModal()">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  <span>Aggiungi Pianta</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Filter bar -->
        <div class="controls-bar">
          <div class="tab-filters">
            <button
              type="button"
              class="filter-pill"
              [class.active]="filterMode === 'all'"
              (click)="filterMode = 'all'"
            >
              Tutte le piante ({{ roomPlants().length }})
            </button>
            <button
              type="button"
              class="filter-pill"
              [class.active]="filterMode === 'thirsty'"
              (click)="filterMode = 'thirsty'"
            >
              💧 Da innaffiare ({{ thirstyPlantsCount() }})
            </button>
          </div>
        </div>

        <!-- Plants in Room Grid -->
        @if (filteredPlants().length === 0) {
          <div class="empty-state glass-panel">
            <div class="empty-icon">🌱</div>
            <h3>
              {{ filterMode === 'thirsty' ? 'Tutte le piante sono dissetate!' : 'Nessuna pianta in questa stanza' }}
            </h3>
            <p>
              {{
                filterMode === 'thirsty'
                  ? 'Ottimo lavoro! Nessuna pianta necessita di acqua al momento in questo ambiente.'
                  : 'Scegli una pianta dal catalogo per posizionarla qui e iniziare a monitorare le sue cure.'
              }}
            </p>
            @if (filterMode === 'all') {
              <button type="button" class="btn btn-primary" (click)="openAddToRoomModal()">
                Colloca la prima Pianta
              </button>
            }
          </div>
        } @else {
          <div class="grid-layout">
            @for (rp of filteredPlants(); track rp.id) {
              <div class="glass-card plant-item-card">
                <!-- Cover Image -->
                <div class="plant-image-wrap" (click)="navigateToPlantCatalog(rp.plantId)">
                  @if (getPlantImage(rp); as img) {
                    <img [src]="img" [alt]="rp.plant?.commonName" class="plant-img" />
                  } @else {
                    <div class="placeholder-icon">🪴</div>
                  }
                  <div class="due-badge" [ngClass]="getDueBadgeClass(rp)">
                    {{ getDueBadgeText(rp) }}
                  </div>
                </div>

                <!-- Plant Info -->
                <div class="plant-card-body">
                  <div class="plant-names" (click)="navigateToPlantCatalog(rp.plantId)">
                    <h3 class="common-name">{{ rp.plant?.commonName || 'Pianta' }}</h3>
                    @if (rp.plant?.scientificName) {
                      <div class="scientific-name">{{ rp.plant?.scientificName }}</div>
                    }
                  </div>

                  @if (rp.position) {
                    <div class="position-tag">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                      </svg>
                      <span>{{ rp.position }}</span>
                    </div>
                  }

                  <div class="care-stats">
                    <div class="stat-row">
                      <span class="stat-label">Ultima innaffiatura:</span>
                      <span class="stat-value">{{ formatLastWatered(rp.lastWateredAt) }}</span>
                    </div>
                    @if (getSeasonalAdvice(rp); as advice) {
                      <div class="stat-advice">
                        💡 {{ advice }}
                      </div>
                    }
                  </div>

                  <!-- Actions footer -->
                  <div class="plant-actions-footer">
                    <div class="left-tools">
                      <!-- Snooze dropdown toggle -->
                      <div class="dropdown-wrapper">
                        <button
                          type="button"
                          class="icon-btn-tool"
                          title="Posticipa innaffiatura"
                          (click)="toggleSnoozeMenu(rp.id)"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                          </svg>
                        </button>
                        @if (activeSnoozeId === rp.id) {
                          <div class="dropdown-menu glass-panel" (click)="$event.stopPropagation()">
                            <div class="menu-label">Ricorda fra:</div>
                            <button type="button" class="menu-item" (click)="snoozePlant(rp.id, 1)">1 ora</button>
                            <button type="button" class="menu-item" (click)="snoozePlant(rp.id, 4)">4 ore</button>
                            <button type="button" class="menu-item" (click)="snoozePlant(rp.id, 8)">8 ore</button>
                            <button type="button" class="menu-item" (click)="snoozePlant(rp.id, 24)">24 ore (1 giorno)</button>
                            <button type="button" class="menu-item" (click)="snoozePlant(rp.id, 48)">48 ore (2 giorni)</button>
                          </div>
                        }
                      </div>

                      <!-- Edit instance -->
                      <button
                        type="button"
                        class="icon-btn-tool"
                        title="Modifica posizione e note"
                        (click)="openEditInstanceModal(rp)"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>

                      <!-- Remove from room -->
                      <button
                        type="button"
                        class="icon-btn-tool btn-remove"
                        title="Rimuovi dalla stanza"
                        (click)="confirmRemovePlant(rp)"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>

                    <!-- 1-Click Water Button -->
                    <button
                      type="button"
                      class="btn btn-sm btn-water"
                      [disabled]="wateringPlantId === rp.id"
                      (click)="waterPlant(rp)"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
                      </svg>
                      <span>Innaffia</span>
                    </button>
                  </div>
                </div>
              </div>
            }
          </div>
        }
      }

      <!-- Edit Instance Modal -->
      @if (showEditModal()) {
        <div class="modal-backdrop" (click)="closeEditModal()">
          <div class="glass-modal modal-card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h2>Modifica Posizione & Note</h2>
              <button type="button" class="icon-close" (click)="closeEditModal()">✕</button>
            </div>

            <form (ngSubmit)="saveInstanceEdit()">
              <div class="form-group">
                <label>Posizione nella stanza</label>
                <input
                  type="text"
                  class="input-field"
                  placeholder="Es: Davanzale finestra, Mensola in alto a sinistra"
                  [(ngModel)]="editFormData.position"
                  name="position"
                />
              </div>

              <div class="form-group">
                <label>Frequenza innaffiatura personalizzata (giorni, opzionale)</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  class="input-field"
                  placeholder="Sovrascrive la frequenza stagionale predefinita"
                  [(ngModel)]="editFormData.customFrequencyDays"
                  name="customFrequencyDays"
                />
              </div>

              <div class="form-group">
                <label>Note sull'esemplare</label>
                <textarea
                  class="input-field textarea"
                  rows="3"
                  placeholder="Note specifiche su questa pianta in questa stanza..."
                  [(ngModel)]="editFormData.notes"
                  name="notes"
                ></textarea>
              </div>

              <div class="modal-actions">
                <button type="button" class="btn btn-outline" (click)="closeEditModal()">
                  Annulla
                </button>
                <button type="submit" class="btn btn-primary" [disabled]="savingInstance()">
                  {{ savingInstance() ? 'Salvataggio...' : 'Salva Modifiche' }}
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
    .room-hero {
      padding: 2rem;
      margin-bottom: 2rem;
      display: flex;
      gap: 2rem;
      align-items: center;
      border-radius: var(--radius-lg);
    }
    .hero-image-wrap {
      width: 160px;
      height: 120px;
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
    .hero-desc {
      margin: 0;
      color: var(--text-muted);
      line-height: 1.5;
    }
    .hero-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .controls-bar {
      margin-bottom: 1.75rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .tab-filters {
      display: flex;
      gap: 0.5rem;
    }
    .filter-pill {
      border: 1px solid var(--border-subtle);
      background: var(--bg-surface);
      color: var(--text-muted);
      padding: 0.5rem 1rem;
      border-radius: var(--radius-full);
      font-size: 0.88rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .filter-pill.active {
      background: var(--color-primary);
      color: #fff;
      border-color: var(--color-primary);
      box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
    }
    .grid-layout {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
      gap: 1.75rem;
    }
    .plant-item-card {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .plant-image-wrap {
      position: relative;
      width: 100%;
      height: 180px;
      background: rgba(16, 185, 129, 0.08);
      cursor: pointer;
      overflow: hidden;
    }
    .plant-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.4s ease;
    }
    .plant-item-card:hover .plant-img {
      transform: scale(1.04);
    }
    .placeholder-icon {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 3rem;
    }
    .due-badge {
      position: absolute;
      top: 10px;
      right: 10px;
      padding: 0.3rem 0.65rem;
      border-radius: var(--radius-full);
      font-size: 0.78rem;
      font-weight: 700;
      backdrop-filter: blur(8px);
      box-shadow: var(--shadow-sm);
    }
    .due-badge.badge-danger {
      background: rgba(239, 68, 68, 0.9);
      color: #fff;
    }
    .due-badge.badge-warning {
      background: rgba(245, 158, 11, 0.9);
      color: #fff;
    }
    .due-badge.badge-success {
      background: rgba(16, 185, 129, 0.9);
      color: #fff;
    }
    .due-badge.badge-default {
      background: rgba(100, 116, 139, 0.85);
      color: #fff;
    }
    .plant-card-body {
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      flex: 1;
    }
    .plant-names {
      cursor: pointer;
      margin-bottom: 0.5rem;
    }
    .common-name {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--text-main);
    }
    .scientific-name {
      font-size: 0.85rem;
      color: var(--text-muted);
      font-style: italic;
      margin-top: 0.15rem;
    }
    .position-tag {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.82rem;
      color: var(--color-primary);
      margin-bottom: 0.75rem;
    }
    .care-stats {
      margin-top: auto;
      padding-top: 0.75rem;
      border-top: 1px solid var(--border-subtle);
      font-size: 0.85rem;
    }
    .stat-row {
      display: flex;
      justify-content: space-between;
      color: var(--text-muted);
      margin-bottom: 0.35rem;
    }
    .stat-value {
      font-weight: 600;
      color: var(--text-main);
    }
    .stat-advice {
      font-size: 0.8rem;
      color: var(--text-secondary);
      background: var(--color-primary-subtle);
      padding: 0.4rem 0.6rem;
      border-radius: var(--radius-sm);
      margin-top: 0.5rem;
      line-height: 1.4;
    }
    .plant-actions-footer {
      margin-top: 1rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .left-tools {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      position: relative;
    }
    .icon-btn-tool {
      background: var(--bg-surface-translucent);
      border: 1px solid var(--border-subtle);
      color: var(--text-muted);
      border-radius: var(--radius-sm);
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .icon-btn-tool:hover {
      color: var(--color-primary);
      border-color: var(--color-primary);
    }
    .btn-remove:hover {
      color: var(--color-danger);
      border-color: var(--color-danger);
    }
    .btn-water {
      background-color: var(--color-primary);
      color: #fff;
      box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3);
    }
    .btn-water:hover {
      background-color: var(--color-primary-hover);
    }
    /* Snooze dropdown */
    .dropdown-wrapper {
      position: relative;
    }
    .dropdown-menu {
      position: absolute;
      bottom: calc(100% + 6px);
      left: 0;
      z-index: 50;
      min-width: 170px;
      padding: 0.5rem;
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-md);
    }
    .menu-label {
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--text-muted);
      padding: 0.25rem 0.5rem;
      text-transform: uppercase;
    }
    .menu-item {
      width: 100%;
      text-align: left;
      background: none;
      border: none;
      padding: 0.4rem 0.5rem;
      border-radius: var(--radius-sm);
      color: var(--text-main);
      font-size: 0.85rem;
      cursor: pointer;
    }
    .menu-item:hover {
      background: var(--color-primary-subtle);
      color: var(--color-primary);
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
      max-width: 480px;
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
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 1.5rem;
    }
  `],
})
export class RoomDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly storage = inject(OfflineStorageService);
  private readonly syncService = inject(SyncService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(Dialog);

  spaceId!: string;
  roomId!: string;
  readonly space = signal<SpaceItem | null>(null);
  readonly room = signal<RoomItem | null>(null);
  readonly roomPlants = signal<RoomPlantItem[]>([]);
  readonly loading = signal(true);

  filterMode: 'all' | 'thirsty' = 'all';
  activeSnoozeId: string | null = null;
  wateringPlantId: string | null = null;

  readonly showEditModal = signal(false);
  readonly savingInstance = signal(false);
  currentEditingInstance: RoomPlantItem | null = null;
  private initialLoaded = false;

  editFormData = {
    position: '',
    customFrequencyDays: null as number | null,
    notes: '',
  };

  constructor() {
    effect(() => {
      this.syncService.dataUpdated();
      if (this.roomId) {
        void this.loadData();
      }
    });
  }

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      this.spaceId = params.get('id')!;
      this.roomId = params.get('roomId')!;
      if (this.spaceId && this.roomId) {
        void this.loadData();
      }
    });

    // Close snooze dropdown on outside click
    if (typeof window !== 'undefined') {
      window.addEventListener('click', () => {
        this.activeSnoozeId = null;
      });
    }
  }

  async loadData() {
    try {
      const sp = await this.storage.getSpace(this.spaceId);
      this.space.set(sp);

      const rm = await this.storage.getRoom(this.roomId);
      if (rm) {
        this.room.set(rm);
        await this.loadRoomPlants();
        this.loading.set(false);
        return;
      }

      if (!this.initialLoaded && !this.syncService.checkIsOffline()) {
        this.initialLoaded = true;
        await this.syncService.sync(true);
        const refreshedRm = await this.storage.getRoom(this.roomId);
        if (refreshedRm) {
          this.room.set(refreshedRm);
          const refreshedSp = await this.storage.getSpace(this.spaceId);
          this.space.set(refreshedSp);
          await this.loadRoomPlants();
          this.loading.set(false);
          return;
        }
      }

      this.toast.error('Stanza non trovata');
      this.router.navigate(['/spaces', this.spaceId]);
    } catch {
      // Local storage read error
    } finally {
      this.loading.set(false);
    }
  }

  async loadRoomPlants() {
    try {
      const plants = await this.storage.getRoomPlantsByRoom(this.roomId);
      for (const rp of plants) {
        const plant = await this.storage.getPlant(rp.plantId);
        if (plant) {
          rp.plant = plant;
        }
      }
      this.roomPlants.set(plants);
    } catch {
      // Local storage read error
    }
  }

  filteredPlants(): RoomPlantItem[] {
    const list = this.roomPlants();
    if (this.filterMode === 'all') return list;
    return list.filter((rp) => this.isThirsty(rp));
  }

  thirstyPlantsCount(): number {
    return this.roomPlants().filter((rp) => this.isThirsty(rp)).length;
  }

  isThirsty(rp: RoomPlantItem): boolean {
    if (rp.snoozedUntil && new Date(rp.snoozedUntil) > new Date()) {
      return false;
    }
    if (!rp.nextWateringDueAt) return true;
    return new Date(rp.nextWateringDueAt) <= new Date();
  }

  getPlantImage(rp: RoomPlantItem): string | null {
    if (rp.plant?.attachments?.length) {
      return `/api/attachments/${rp.plant.attachments[0].id}/preview`;
    }
    return null;
  }

  getDueBadgeText(rp: RoomPlantItem): string {
    if (rp.snoozedUntil && new Date(rp.snoozedUntil) > new Date()) {
      const date = new Date(rp.snoozedUntil);
      return `Posticipata fino alle ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (!rp.nextWateringDueAt) return 'Da innaffiare';

    const due = new Date(rp.nextWateringDueAt).getTime();
    const now = Date.now();
    const diffDays = Math.round((due - now) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const absDays = Math.abs(diffDays);
      return `In ritardo di ${absDays} ${absDays === 1 ? 'giorno' : 'giorni'}`;
    }
    if (diffDays === 0) return 'Innaffia oggi';
    if (diffDays === 1) return 'Innaffia domani';
    return `Fra ${diffDays} giorni`;
  }

  getDueBadgeClass(rp: RoomPlantItem): string {
    if (rp.snoozedUntil && new Date(rp.snoozedUntil) > new Date()) {
      return 'badge-default';
    }
    if (!rp.nextWateringDueAt) return 'badge-danger';
    const due = new Date(rp.nextWateringDueAt).getTime();
    const now = Date.now();
    const diffDays = Math.round((due - now) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'badge-danger';
    if (diffDays === 0) return 'badge-warning';
    return 'badge-success';
  }

  formatLastWatered(dateStr?: string | null): string {
    if (!dateStr) return 'Mai';
    const d = new Date(dateStr);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  }

  getSeasonalAdvice(rp: RoomPlantItem): string | null {
    const sc = rp.plant?.seasonalCare;
    if (!sc) return null;
    const month = new Date().getMonth();
    let currentCare = sc.spring;
    if (month >= 5 && month <= 7) currentCare = sc.summer;
    else if (month >= 8 && month <= 10) currentCare = sc.autumn;
    else if (month >= 11 || month <= 1) currentCare = sc.winter;

    return currentCare?.watering?.advices || null;
  }

  toggleSnoozeMenu(id: string) {
    this.activeSnoozeId = this.activeSnoozeId === id ? null : id;
  }

  async snoozePlant(rpId: string, hours: number) {
    const rp = this.roomPlants().find((p) => p.id === rpId);
    if (!rp) return;

    const snoozedUntil = new Date(Date.now() + hours * 3600000).toISOString();
    const updated: RoomPlantItem = {
      ...rp,
      snoozedUntil,
      updatedAt: new Date().toISOString(),
    };

    await this.storage.saveRoomPlants([updated]);
    await this.syncService.queueRoomPlantChange(rpId, 'update', { snoozedUntil });

    this.toast.success(`Innaffiatura posticipata di ${hours} ore`);
    this.activeSnoozeId = null;
  }

  async waterPlant(rp: RoomPlantItem) {
    this.wateringPlantId = rp.id;
    try {
      const now = new Date().toISOString();
      const freq = getWateringFrequencyDays(rp.plant, rp.customFrequencyDays);
      const nextDue = computeNextWateringDate(now, freq);

      const updated: RoomPlantItem = {
        ...rp,
        lastWateredAt: now,
        nextWateringDueAt: nextDue,
        snoozedUntil: null,
        updatedAt: now,
      };

      await this.storage.saveRoomPlants([updated]);

      const log: WateringLogItem = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `log_${Date.now()}`,
        roomPlantId: rp.id,
        wateredAt: now,
        notes: null,
        source: 'web',
      };
      await this.syncService.queueWateringLog(log);
      await this.syncService.queueRoomPlantChange(rp.id, 'update', {
        lastWateredAt: now,
        nextWateringDueAt: nextDue,
        snoozedUntil: null,
      });

      this.toast.success(`💧 Innaffiata con successo: ${rp.plant?.commonName || 'Pianta'}`);
    } finally {
      this.wateringPlantId = null;
    }
  }

  async confirmWaterAll() {
    const count = this.roomPlants().length;
    const dialogRef = this.dialog.open<boolean>(ConfirmModalComponent, {
      data: {
        title: 'Innaffia tutte le piante?',
        message: `Stai per registrare l’innaffiatura per tutte le ${count} piante presenti in questa stanza. Confermi?`,
        confirmLabel: 'Innaffia Tutte',
        confirmVariant: 'primary',
      },
    });

    const confirmed = await firstValueFrom(dialogRef.closed);
    if (!confirmed) return;

    const now = new Date().toISOString();
    const updatedList: RoomPlantItem[] = [];

    for (const rp of this.roomPlants()) {
      const freq = getWateringFrequencyDays(rp.plant, rp.customFrequencyDays);
      const nextDue = computeNextWateringDate(now, freq);

      const updated: RoomPlantItem = {
        ...rp,
        lastWateredAt: now,
        nextWateringDueAt: nextDue,
        snoozedUntil: null,
        updatedAt: now,
      };
      updatedList.push(updated);

      const log: WateringLogItem = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `log_${Date.now()}_${Math.random()}`,
        roomPlantId: rp.id,
        wateredAt: now,
        notes: null,
        source: 'bulk-room',
      };
      await this.syncService.queueWateringLog(log);
      await this.syncService.queueRoomPlantChange(rp.id, 'update', {
        lastWateredAt: now,
        nextWateringDueAt: nextDue,
        snoozedUntil: null,
      });
    }

    await this.storage.saveRoomPlants(updatedList);
    this.toast.success(`💧 Tutte le ${updatedList.length} piante sono state innaffiate!`);
  }

  openAddToRoomModal() {
    const dialogRef = this.dialog.open(AddToRoomModalComponent, {
      data: {
        roomId: this.roomId,
        spaceId: this.spaceId,
      },
    });

    dialogRef.closed.subscribe((res) => {
      if (res) {
        void this.loadRoomPlants();
      }
    });
  }

  openEditInstanceModal(rp: RoomPlantItem) {
    this.currentEditingInstance = rp;
    this.editFormData = {
      position: rp.position || '',
      customFrequencyDays: rp.customFrequencyDays || null,
      notes: rp.notes || '',
    };
    this.showEditModal.set(true);
  }

  closeEditModal() {
    this.showEditModal.set(false);
  }

  async saveInstanceEdit() {
    if (!this.currentEditingInstance) return;
    this.savingInstance.set(true);

    const now = new Date().toISOString();
    const payload: Partial<RoomPlantItem> = {
      position: this.editFormData.position.trim() || null,
      customFrequencyDays: this.editFormData.customFrequencyDays
        ? Number(this.editFormData.customFrequencyDays)
        : null,
      notes: this.editFormData.notes.trim() || null,
    };

    const updated: RoomPlantItem = {
      ...this.currentEditingInstance,
      ...payload,
      updatedAt: now,
    };

    await this.storage.saveRoomPlants([updated]);
    await this.syncService.queueRoomPlantChange(this.currentEditingInstance.id, 'update', payload);

    this.toast.success('Dettagli pianta aggiornati');
    this.savingInstance.set(false);
    this.closeEditModal();
  }

  async confirmRemovePlant(rp: RoomPlantItem) {
    const dialogRef = this.dialog.open<boolean>(ConfirmModalComponent, {
      data: {
        title: `Rimuovere ${rp.plant?.commonName || 'pianta'}?`,
        message:
          'Questa pianta verrà rimossa da questa stanza e il monitoraggio delle innaffiature verrà interrotto. La scheda botanica rimarrà salvata intatta nel tuo Catalogo Piante.',
        confirmLabel: 'Rimuovi dalla stanza',
        confirmVariant: 'danger',
      },
    });

    const confirmed = await firstValueFrom(dialogRef.closed);
    if (confirmed) {
      await this.storage.removeRoomPlants([rp.id]);
      await this.syncService.queueRoomPlantChange(rp.id, 'delete');
      this.toast.success('Pianta rimossa dalla stanza');
    }
  }

  navigateToPlantCatalog(plantId?: string) {
    if (plantId) {
      this.router.navigate(['/plants', plantId]);
    }
  }
}

