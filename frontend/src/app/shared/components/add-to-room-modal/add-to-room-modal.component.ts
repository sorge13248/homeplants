import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ApiService } from '../../../core/api.service';
import { OfflineStorageService } from '../../../core/offline-storage.service';
import { PlantItem, RoomItem, SpaceItem } from '../../../core/models';

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
  template: `
    <div class="glass-modal modal-box">
      <div class="modal-header">
        <h2>Aggiungi a Stanza</h2>
        @if (data.plantName) {
          <p class="subtitle">Stai posizionando: <strong>{{ data.plantName }}</strong></p>
        }
      </div>

      <div class="modal-body">
        <!-- Step 1: Selezione Spazio (se non preimpostato) -->
        @if (!data.spaceId) {
          <div class="form-group">
            <label>1. Seleziona lo Spazio Verde</label>
            <select
              class="input-field select-field"
              [ngModel]="selectedSpaceId()"
              (ngModelChange)="onSpaceChange($event)"
            >
              <option value="" disabled selected>-- Scegli uno spazio --</option>
              @for (space of spaces(); track space.id) {
                <option [value]="space.id">{{ space.name }}</option>
              }
            </select>
          </div>
        }

        <!-- Step 2: Selezione Stanza (se non preimpostata) -->
        @if (!data.roomId) {
          <div class="form-group">
            <label>2. Seleziona la Stanza</label>
            <select
              class="input-field select-field"
              [disabled]="!selectedSpaceId()"
              [(ngModel)]="selectedRoomId"
            >
              <option value="" disabled selected>-- Scegli una stanza --</option>
              @for (room of filteredRooms(); track room.id) {
                <option [value]="room.id">{{ room.name }}</option>
              }
            </select>
          </div>
        }

        <!-- Selezione Pianta (se aperta da dentro una stanza) -->
        @if (!data.plantId) {
          <div class="form-group">
            <label>Seleziona la Pianta dal Catalogo</label>
            <select class="input-field select-field" [(ngModel)]="selectedPlantId">
              <option value="" disabled selected>-- Scegli una pianta --</option>
              @for (plant of plants(); track plant.id) {
                <option [value]="plant.id">{{ plant.commonName }}</option>
              }
            </select>
          </div>
        }

        <!-- Step 3: Posizione e informazioni specifiche -->
        <div class="form-group">
          <label>Posizione nella stanza</label>
          <input
            type="text"
            class="input-field"
            placeholder="es. Sul davanzale a est, mensola in alto..."
            [(ngModel)]="position"
          />
        </div>

        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" [(ngModel)]="wateredToday" />
            <span>La pianta è stata innaffiata oggi</span>
          </label>
        </div>

        <div class="form-group">
          <label>Frequenza personalizzata per questa stanza (giorni, facoltativo)</label>
          <input
            type="number"
            min="1"
            max="60"
            class="input-field"
            placeholder="Lascia vuoto per ereditare dalla pianta"
            [(ngModel)]="customFrequencyDays"
          />
        </div>

        <div class="form-group">
          <label>Note aggiuntive (facoltativo)</label>
          <textarea
            class="input-field"
            rows="2"
            placeholder="es. Esposizione a correnti, vaso in terracotta..."
            [(ngModel)]="notes"
          ></textarea>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn-outline" (click)="cancel()">
          Annulla
        </button>
        <button
          type="button"
          class="btn btn-primary"
          [disabled]="!canSubmit()"
          (click)="submit()"
        >
          Aggiungi alla stanza
        </button>
      </div>
    </div>
  `,
  styles: [`
    .modal-box {
      width: 90vw;
      max-width: 480px;
      padding: 1.75rem 2rem;
    }
    .modal-header {
      margin-bottom: 1.25rem;
      h2 {
        margin: 0 0 0.25rem 0;
        font-size: 1.35rem;
        color: var(--text-main);
      }
      .subtitle {
        margin: 0;
        font-size: 0.88rem;
        color: var(--text-muted);
      }
    }
    .form-group {
      margin-bottom: 1rem;
      label {
        display: block;
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--text-main);
        margin-bottom: 0.4rem;
      }
    }
    .select-field {
      cursor: pointer;
    }
    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
      input {
        width: 16px;
        height: 16px;
        accent-color: var(--color-primary);
      }
      span {
        font-size: 0.9rem;
        font-weight: 500;
      }
    }
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 1.5rem;
    }
  `],
})
export class AddToRoomModalComponent implements OnInit {
  readonly data: AddToRoomModalData = inject(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef);
  private readonly storage = inject(OfflineStorageService);
  private readonly api = inject(ApiService);

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

  async ngOnInit() {
    // Load from local storage or api
    const spaces = await this.storage.getAllSpaces();
    this.spaces.set(spaces);

    const rooms = await this.storage.getAllRooms();
    this.allRooms.set(rooms);

    const plants = await this.storage.getAllPlants();
    this.plants.set(plants);
  }

  filteredRooms(): RoomItem[] {
    const spaceId = this.selectedSpaceId();
    if (!spaceId) return [];
    return this.allRooms().filter((r) => r.spaceId === spaceId);
  }

  onSpaceChange(newSpaceId: string) {
    this.selectedSpaceId.set(newSpaceId);
    this.selectedRoomId = '';
  }

  canSubmit(): boolean {
    const roomValid = Boolean(this.data.roomId || this.selectedRoomId);
    const plantValid = Boolean(this.data.plantId || this.selectedPlantId);
    return roomValid && plantValid;
  }

  submit() {
    const roomId = this.data.roomId || this.selectedRoomId;
    const plantId = this.data.plantId || this.selectedPlantId;

    this.dialogRef.close({
      roomId,
      plantId,
      position: this.position.trim() || null,
      lastWateredAt: this.wateredToday ? new Date().toISOString() : null,
      customFrequencyDays: this.customFrequencyDays ? Number(this.customFrequencyDays) : null,
      notes: this.notes.trim() || null,
    });
  }

  cancel() {
    this.dialogRef.close(null);
  }
}

