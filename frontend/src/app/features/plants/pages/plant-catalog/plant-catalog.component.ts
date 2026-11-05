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
  templateUrl: './plant-catalog.component.html',
  styleUrl: './plant-catalog.component.scss',
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

      list.sort((a, b) => (a.commonName || '').localeCompare(b.commonName || ''));
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
    const list = !q
      ? this.plants()
      : this.plants().filter(
          (p) =>
            p.commonName.toLowerCase().includes(q) ||
            (p.scientificName && p.scientificName.toLowerCase().includes(q)),
        );
    return [...list].sort((a, b) => (a.commonName || '').localeCompare(b.commonName || ''));
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

