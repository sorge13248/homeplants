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
  templateUrl: './room-detail.component.html',
  styleUrl: './room-detail.component.scss',
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
      plants.sort((a, b) =>
        (a.plant?.commonName || a.plant?.scientificName || '').localeCompare(
          b.plant?.commonName || b.plant?.scientificName || '',
        ),
      );
      this.roomPlants.set(plants);
    } catch {
      // Local storage read error
    }
  }

  filteredPlants(): RoomPlantItem[] {
    const list = this.roomPlants();
    const filtered = this.filterMode === 'all' ? list : list.filter((rp) => this.isThirsty(rp));
    return [...filtered].sort((a, b) =>
      (a.plant?.commonName || a.plant?.scientificName || '').localeCompare(
        b.plant?.commonName || b.plant?.scientificName || '',
      ),
    );
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

