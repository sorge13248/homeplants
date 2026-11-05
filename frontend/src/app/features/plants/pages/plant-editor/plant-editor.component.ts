import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../../../core/api.service';
import { OfflineStorageService } from '../../../../core/offline-storage.service';
import { SyncService } from '../../../../core/sync.service';
import { ToastService } from '../../../../core/toast.service';
import { AttachmentItem, PlantItem, PlantSeasonalCare } from '../../../../core/models';
import { SeasonTabsComponent } from '../../../../shared/components/season-tabs/season-tabs.component';

@Component({
  selector: 'app-plant-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SeasonTabsComponent],
  templateUrl: './plant-editor.component.html',
  styleUrl: './plant-editor.component.scss',
})
export class PlantEditorComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly storage = inject(OfflineStorageService);
  private readonly syncService = inject(SyncService);
  private readonly toast = inject(ToastService);

  readonly isEditing = signal(false);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly uploadingPhoto = signal(false);

  plantId: string | null = null;
  readonly attachments = signal<AttachmentItem[]>([]);

  plantData: {
    commonName: string;
    scientificName: string;
    seasonalCare: PlantSeasonalCare;
    soilRepotting: {
      repottingSeason: 'spring' | 'summer' | 'autumn' | 'winter' | 'any';
      potType: string;
      soilType: string;
      composition: string;
    };
    fertilization: {
      period: string;
      frequencyDays: number | null;
      fertilizerType: string;
      notes: string;
    };
  } = {
    commonName: '',
    scientificName: '',
    seasonalCare: {
      spring: { sunExposure: 'indirect', watering: { frequencyDays: 5, advices: '' } },
      summer: { sunExposure: 'indirect', watering: { frequencyDays: 3, advices: '' } },
      autumn: { sunExposure: 'indirect', watering: { frequencyDays: 7, advices: '' } },
      winter: { sunExposure: 'indirect', watering: { frequencyDays: 10, advices: '' } },
    },
    soilRepotting: {
      repottingSeason: 'spring',
      potType: '',
      soilType: '',
      composition: '',
    },
    fertilization: {
      period: '',
      frequencyDays: null,
      fertilizerType: '',
      notes: '',
    },
  };

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id && id !== 'new') {
        this.plantId = id;
        this.isEditing.set(true);
        this.loadExistingPlant(id);
      }
    });
  }

  async loadExistingPlant(id: string) {
    this.loading.set(true);
    try {
      const pl = await this.storage.getPlant(id);
      if (!pl) {
        this.toast.error('Pianta non trovata');
        this.router.navigate(['/plants']);
        return;
      }
      this.plantData.commonName = pl.commonName || '';
      this.plantData.scientificName = pl.scientificName || '';
      if (pl.seasonalCare) {
        this.plantData.seasonalCare = pl.seasonalCare;
      }
      if (pl.soilRepotting) {
        this.plantData.soilRepotting = {
          repottingSeason: pl.soilRepotting.repottingSeason || 'spring',
          potType: pl.soilRepotting.potType || '',
          soilType: pl.soilRepotting.soilType || '',
          composition: pl.soilRepotting.composition || '',
        };
      }
      if (pl.fertilization) {
        this.plantData.fertilization = {
          period: pl.fertilization.period || '',
          frequencyDays: pl.fertilization.frequencyDays || null,
          fertilizerType: pl.fertilization.fertilizerType || '',
          notes: pl.fertilization.notes || '',
        };
      }
      if (pl.attachments) {
        this.attachments.set(pl.attachments);
      }
    } catch {
      this.toast.error('Errore nel caricamento della pianta');
      this.router.navigate(['/plants']);
    } finally {
      this.loading.set(false);
    }
  }

  onSeasonalCareChange(care: PlantSeasonalCare) {
    this.plantData.seasonalCare = care;
  }

  onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const files = Array.from(input.files);
    input.value = '';
    this.uploadingPhoto.set(true);

    const uploadPromises = files.map((file, idx) => {
      return new Promise<AttachmentItem | null>((resolve) => {
        this.api
          .uploadAttachment(file, {
            plantId: this.plantId || undefined,
            sortOrder: this.attachments().length + idx,
          })
          .subscribe({
            next: (att) => resolve(att),
            error: () => resolve(null),
          });
      });
    });

    Promise.all(uploadPromises).then((results) => {
      const successful = results.filter((r): r is AttachmentItem => Boolean(r));
      if (successful.length) {
        this.attachments.update((list) => [...list, ...successful]);
        this.toast.success(`${successful.length} foto caricate`);
      }
      this.uploadingPhoto.set(false);
    });
  }

  removeAttachment(attId: string) {
    this.attachments.update((list) => list.filter((a) => a.id !== attId));
  }

  async savePlant() {
    if (!this.plantData.commonName.trim()) return;

    this.saving.set(true);
    const now = new Date().toISOString();
    const payload: Partial<PlantItem> = {
      commonName: this.plantData.commonName.trim(),
      scientificName: this.plantData.scientificName.trim() || null,
      seasonalCare: this.plantData.seasonalCare,
      soilRepotting: this.plantData.soilRepotting,
      fertilization: {
        ...this.plantData.fertilization,
        frequencyDays: this.plantData.fertilization.frequencyDays
          ? Number(this.plantData.fertilization.frequencyDays)
          : null,
      } as any,
      attachments: this.attachments(),
    };

    try {
      if (this.isEditing() && this.plantId) {
        const existing = await this.storage.getPlant(this.plantId);
        const updatedPlant: PlantItem = {
          ...(existing || {}),
          id: this.plantId,
          commonName: payload.commonName!,
          scientificName: payload.scientificName ?? null,
          seasonalCare: payload.seasonalCare,
          soilRepotting: payload.soilRepotting,
          fertilization: payload.fertilization,
          attachments: payload.attachments,
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        };
        await this.storage.savePlants([updatedPlant]);
        await this.syncService.queuePlantChange(this.plantId, 'update', payload as Record<string, unknown>);
        this.toast.success('Scheda botanica aggiornata');
        this.router.navigate(['/plants', this.plantId]);
      } else {
        const id = crypto.randomUUID();
        const newPlant: PlantItem = {
          id,
          commonName: payload.commonName!,
          scientificName: payload.scientificName ?? null,
          seasonalCare: payload.seasonalCare,
          soilRepotting: payload.soilRepotting,
          fertilization: payload.fertilization,
          attachments: payload.attachments,
          createdAt: now,
          updatedAt: now,
        };
        await this.storage.savePlants([newPlant]);
        await this.syncService.queuePlantChange(id, 'create', newPlant as unknown as Record<string, unknown>);
        this.toast.success('Nuova pianta aggiunta al catalogo');
        this.router.navigate(['/plants', id]);
      }
    } catch {
      this.toast.error('Errore durante il salvataggio della scheda');
    } finally {
      this.saving.set(false);
    }
  }

  cancel() {
    if (this.isEditing() && this.plantId) {
      this.router.navigate(['/plants', this.plantId]);
    } else {
      this.router.navigate(['/plants']);
    }
  }
}

