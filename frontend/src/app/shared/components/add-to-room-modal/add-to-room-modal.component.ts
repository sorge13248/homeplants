import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { OfflineStorageService } from '../../../core/offline-storage.service';
import { SyncService } from '../../../core/sync.service';
import { ToastService } from '../../../core/toast.service';
import { PlantItem, RoomItem, RoomPlantItem, SpaceItem, WateringLogItem } from '../../../core/models';
import { computeNextWateringDate, getWateringFrequencyDays } from '../../../core/watering.utils';

export interface AddToRoomModalData {
  plantId?: string;
  plantName?: string;
  roomId?: string;
  spaceId?: string;
}

@Component({
  selector: 'app-add-to-room-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-to-room-modal.component.html',
  styleUrl: './add-to-room-modal.component.scss',
})
export class AddToRoomModalComponent implements OnInit {
  readonly data: AddToRoomModalData = inject(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef);
  private readonly storage = inject(OfflineStorageService);
  private readonly syncService = inject(SyncService);
  private readonly toast = inject(ToastService);

  readonly spaces = signal<SpaceItem[]>([]);
  readonly allRooms = signal<RoomItem[]>([]);
  readonly plants = signal<PlantItem[]>([]);

  readonly selectedSpaceId = signal<string>(this.data.spaceId || '');
  selectedRoomId = this.data.roomId || '';
  selectedPlantId = this.data.plantId || '';
  position = '';
  wateredToday = true;
  customFrequencyDays: number | null = null;
  notes = '';
  submitting = false;

  async ngOnInit() {
    const spaces = await this.storage.getAllSpaces();
    this.spaces.set(spaces.sort((a, b) => (a.name || '').localeCompare(b.name || '')));

    const rooms = await this.storage.getAllRooms();
    this.allRooms.set(rooms.sort((a, b) => (a.name || '').localeCompare(b.name || '')));

    const plants = await this.storage.getAllPlants();
    this.plants.set(plants.sort((a, b) => (a.commonName || '').localeCompare(b.commonName || '')));
  }

  filteredRooms(): RoomItem[] {
    const spaceId = this.selectedSpaceId();
    if (!spaceId) return [];
    return this.allRooms()
      .filter((r) => r.spaceId === spaceId)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  onSpaceChange(newSpaceId: string) {
    this.selectedSpaceId.set(newSpaceId);
    this.selectedRoomId = '';
  }

  canSubmit(): boolean {
    const roomValid = Boolean(this.data.roomId || this.selectedRoomId);
    const plantValid = Boolean(this.data.plantId || this.selectedPlantId);
    return roomValid && plantValid && !this.submitting;
  }

  async submit() {
    if (!this.canSubmit()) return;
    this.submitting = true;

    try {
      const roomId = this.data.roomId || this.selectedRoomId;
      const plantId = this.data.plantId || this.selectedPlantId;
      const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `rp_${Date.now()}`;
      const now = new Date().toISOString();

      const plant = await this.storage.getPlant(plantId);
      const customFreq = this.customFrequencyDays ? Number(this.customFrequencyDays) : null;
      const freq = getWateringFrequencyDays(plant, customFreq);
      const lastWatered = this.wateredToday ? now : null;
      const nextDue = this.wateredToday ? computeNextWateringDate(now, freq) : now;

      const newRoomPlant: RoomPlantItem = {
        id,
        roomId,
        plantId,
        plant: plant ?? undefined,
        position: this.position.trim() || null,
        customFrequencyDays: customFreq,
        lastWateredAt: lastWatered,
        nextWateringDueAt: nextDue,
        snoozedUntil: null,
        notes: this.notes.trim() || null,
        createdAt: now,
        updatedAt: now,
      };

      await this.storage.saveRoomPlants([newRoomPlant]);

      if (this.wateredToday) {
        const log: WateringLogItem = {
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `log_${Date.now()}`,
          roomPlantId: id,
          wateredAt: now,
          notes: null,
          source: 'web',
        };
        await this.syncService.queueWateringLog(log);
      }

      await this.syncService.queueRoomPlantChange(id, 'create', newRoomPlant);
      this.toast.success('Pianta collocata nella stanza con successo!');
      this.dialogRef.close(newRoomPlant);
    } catch {
      this.toast.error('Errore durante il salvataggio');
    } finally {
      this.submitting = false;
    }
  }

  cancel() {
    this.dialogRef.close(null);
  }
}

