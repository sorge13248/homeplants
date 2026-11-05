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
  templateUrl: './plant-detail.component.html',
  styleUrl: './plant-detail.component.scss',
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
        rps.sort((a, b) => (a.room?.name || '').localeCompare(b.room?.name || ''));
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

