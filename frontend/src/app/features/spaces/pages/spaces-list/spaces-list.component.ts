import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../../core/api.service';
import { OfflineStorageService } from '../../../../core/offline-storage.service';
import { SyncService } from '../../../../core/sync.service';
import { MapProviderService } from '../../../../core/map-provider.service';
import { ToastService } from '../../../../core/toast.service';
import { SpaceItem, UserSettings } from '../../../../core/models';
import { AppCardComponent } from '../../../../shared/components/app-card/app-card.component';
import { ConfirmModalComponent } from '../../../../shared/components/confirm-modal/confirm-modal.component';

@Component({
  selector: 'app-spaces-list',
  standalone: true,
  imports: [CommonModule, FormsModule, AppCardComponent],
  templateUrl: './spaces-list.component.html',
  styleUrl: './spaces-list.component.scss',
})
export class SpacesListComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly storage = inject(OfflineStorageService);
  private readonly syncService = inject(SyncService);
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
  private initialLoaded = false;

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

  constructor() {
    effect(() => {
      this.syncService.dataUpdated();
      void this.loadData();
    });
  }

  ngOnInit() {
    void this.loadData();
  }

  async loadData() {
    try {
      this.userSettings = (await this.storage.getSettings()) || null;
      const spaces = await this.storage.getAllSpaces();
      const rooms = await this.storage.getAllRooms();

      for (const s of spaces) {
        s.rooms = rooms
          .filter((r) => r.spaceId === s.id)
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      }

      spaces.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      this.spaces.set(spaces);

      if (spaces.length === 0 && !this.initialLoaded && !this.syncService.checkIsOffline()) {
        this.initialLoaded = true;
        await this.syncService.sync(true);
      }
    } catch {
      // Local storage read error
    } finally {
      this.loading.set(false);
    }
  }

  filteredSpaces(): SpaceItem[] {
    const q = this.searchQuery.toLowerCase().trim();
    const list = !q
      ? this.spaces()
      : this.spaces().filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            (s.location && s.location.toLowerCase().includes(q)) ||
            (s.description && s.description.toLowerCase().includes(q)),
        );
    return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
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

  async saveSpace() {
    if (!this.formData.name.trim()) return;

    this.saving.set(true);
    const now = new Date().toISOString();

    const payload: Partial<SpaceItem> = {
      name: this.formData.name.trim(),
      location: this.formData.location.trim() || null,
      description: this.formData.description.trim() || null,
      coverPhotoUrl: this.formData.coverPhotoUrl,
    };

    if (this.isEditing() && this.currentEditingId) {
      const existing = await this.storage.getSpace(this.currentEditingId);
      const updated: SpaceItem = {
        ...(existing ?? ({} as SpaceItem)),
        id: this.currentEditingId,
        name: payload.name!,
        location: payload.location ?? null,
        description: payload.description ?? null,
        coverPhotoUrl: payload.coverPhotoUrl ?? null,
        updatedAt: now,
      };
      await this.storage.saveSpaces([updated]);
      await this.syncService.queueSpaceChange(this.currentEditingId, 'update', payload);

      this.toast.success('Spazio aggiornato');
      this.saving.set(false);
      this.closeModal();
    } else {
      const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `space_${Date.now()}`;
      const newSpace: SpaceItem = {
        id,
        name: payload.name!,
        location: payload.location ?? null,
        description: payload.description ?? null,
        coverPhotoUrl: payload.coverPhotoUrl ?? null,
        rooms: [],
        createdAt: now,
        updatedAt: now,
      };
      await this.storage.saveSpaces([newSpace]);
      await this.syncService.queueSpaceChange(id, 'create', newSpace);

      this.toast.success('Nuovo spazio creato con successo');
      this.saving.set(false);
      this.closeModal();
    }
  }

  async confirmDeleteSpace(space: SpaceItem) {
    const dialogRef = this.dialog.open<boolean>(ConfirmModalComponent, {
      data: {
        title: `Elimina "${space.name}"?`,
        message:
          'Sei sicuro di voler eliminare questo spazio verde? Tutte le stanze contenute verranno rimosse, ma le piante rimarranno salvate nel tuo Catalogo Piante.',
        confirmLabel: 'Elimina Spazio',
        confirmVariant: 'danger',
      },
    });

    const confirmed = await firstValueFrom(dialogRef.closed);
    if (confirmed) {
      await this.storage.removeSpaces([space.id]);
      const rooms = await this.storage.getRoomsBySpace(space.id);
      if (rooms.length) {
        await this.storage.removeRooms(rooms.map((r) => r.id));
        for (const r of rooms) {
          const rps = await this.storage.getRoomPlantsByRoom(r.id);
          if (rps.length) {
            await this.storage.removeRoomPlants(rps.map((p) => p.id));
          }
        }
      }
      await this.syncService.queueSpaceChange(space.id, 'delete');
      this.toast.success('Spazio eliminato');
    }
  }
}

