import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../../core/api.service';
import { OfflineStorageService } from '../../../../core/offline-storage.service';
import { SyncService } from '../../../../core/sync.service';
import { MapProviderService } from '../../../../core/map-provider.service';
import { ToastService } from '../../../../core/toast.service';
import { RoomItem, SpaceItem, UserSettings } from '../../../../core/models';
import { AppCardComponent } from '../../../../shared/components/app-card/app-card.component';
import { ConfirmModalComponent } from '../../../../shared/components/confirm-modal/confirm-modal.component';

@Component({
  selector: 'app-space-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AppCardComponent],
  templateUrl: './space-detail.component.html',
  styleUrl: './space-detail.component.scss',
})
export class SpaceDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly storage = inject(OfflineStorageService);
  private readonly syncService = inject(SyncService);
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
  private initialLoaded = false;

  roomFormData: {
    name: string;
    description: string;
    coverPhotoUrl: string | null;
  } = {
    name: '',
    description: '',
    coverPhotoUrl: null,
  };

  constructor() {
    effect(() => {
      this.syncService.dataUpdated();
      if (this.spaceId) {
        void this.loadData();
      }
    });
  }

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      this.spaceId = params.get('id')!;
      if (this.spaceId) {
        void this.loadData();
      }
    });
  }

  async loadData() {
    try {
      this.userSettings = (await this.storage.getSettings()) || null;
      const sp = await this.storage.getSpace(this.spaceId);

      if (sp) {
        this.space.set(sp);
        const rooms = await this.storage.getRoomsBySpace(this.spaceId);
        rooms.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        this.rooms.set(rooms);
        this.loading.set(false);
        return;
      }

      if (!this.initialLoaded && !this.syncService.checkIsOffline()) {
        this.initialLoaded = true;
        await this.syncService.sync(true);
        const refreshedSp = await this.storage.getSpace(this.spaceId);
        if (refreshedSp) {
          this.space.set(refreshedSp);
          const rms = await this.storage.getRoomsBySpace(this.spaceId);
          rms.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          this.rooms.set(rms);
          this.loading.set(false);
          return;
        }
      }

      this.toast.error('Spazio non trovato');
      this.router.navigate(['/spaces']);
    } catch {
      // Local storage read error
    } finally {
      this.loading.set(false);
    }
  }

  async loadRooms() {
    if (!this.spaceId) return;
    const rooms = await this.storage.getRoomsBySpace(this.spaceId);
    rooms.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    this.rooms.set(rooms);
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

  async saveRoom() {
    if (!this.roomFormData.name.trim()) return;

    this.savingRoom.set(true);
    const now = new Date().toISOString();
    const payload: Partial<RoomItem> = {
      spaceId: this.spaceId,
      name: this.roomFormData.name.trim(),
      description: this.roomFormData.description.trim() || null,
      coverPhotoUrl: this.roomFormData.coverPhotoUrl,
    };

    if (this.isEditingRoom() && this.currentEditingRoomId) {
      const existing = await this.storage.getRoom(this.currentEditingRoomId);
      const updated: RoomItem = {
        ...(existing ?? ({} as RoomItem)),
        id: this.currentEditingRoomId,
        spaceId: this.spaceId,
        name: payload.name!,
        description: payload.description ?? null,
        coverPhotoUrl: payload.coverPhotoUrl ?? null,
        updatedAt: now,
      };
      await this.storage.saveRooms([updated]);
      await this.syncService.queueRoomChange(this.currentEditingRoomId, 'update', payload);

      this.toast.success('Stanza aggiornata');
      this.savingRoom.set(false);
      this.closeRoomModal();
    } else {
      const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `room_${Date.now()}`;
      const newRoom: RoomItem = {
        id,
        spaceId: this.spaceId,
        name: payload.name!,
        description: payload.description ?? null,
        coverPhotoUrl: payload.coverPhotoUrl ?? null,
        roomPlants: [],
        createdAt: now,
        updatedAt: now,
      };
      await this.storage.saveRooms([newRoom]);
      await this.syncService.queueRoomChange(id, 'create', newRoom);

      this.toast.success('Nuova stanza creata');
      this.savingRoom.set(false);
      this.closeRoomModal();
    }
  }

  async confirmDeleteRoom(room: RoomItem) {
    const dialogRef = this.dialog.open<boolean>(ConfirmModalComponent, {
      data: {
        title: `Elimina stanza "${room.name}"?`,
        message:
          'Sei sicuro di voler eliminare questa stanza? Le piante collocate qui verranno rimosse dall’ambiente, ma rimarranno intatte nel tuo Catalogo Piante.',
        confirmLabel: 'Elimina Stanza',
        confirmVariant: 'danger',
      },
    });

    const confirmed = await firstValueFrom(dialogRef.closed);
    if (confirmed) {
      await this.storage.removeRooms([room.id]);
      const rps = await this.storage.getRoomPlantsByRoom(room.id);
      if (rps.length) {
        await this.storage.removeRoomPlants(rps.map((p) => p.id));
      }
      await this.syncService.queueRoomChange(room.id, 'delete');
      this.toast.success('Stanza eliminata');
    }
  }
}

