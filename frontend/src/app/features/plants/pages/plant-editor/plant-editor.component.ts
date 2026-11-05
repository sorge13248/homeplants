import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../../../core/api.service';
import { ToastService } from '../../../../core/toast.service';
import { AttachmentItem, PlantItem, PlantSeasonalCare } from '../../../../core/models';
import { SeasonTabsComponent } from '../../../../shared/components/season-tabs/season-tabs.component';

@Component({
  selector: 'app-plant-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SeasonTabsComponent],
  template: `
    <div class="page-container">
      <!-- Breadcrumbs -->
      <nav class="breadcrumbs">
        <a routerLink="/plants" class="breadcrumb-link">Catalogo Piante</a>
        <span class="separator">/</span>
        <span class="current">{{ isEditing() ? 'Modifica ' + (plantData.commonName || 'Pianta') : 'Nuova Pianta' }}</span>
      </nav>

      <div class="editor-header">
        <h1 class="page-title">{{ isEditing() ? 'Modifica Scheda Botanica' : 'Nuova Pianta nel Catalogo' }}</h1>
        <p class="page-subtitle">
          Configura i dati botanici, il fabbisogno d'acqua stagionale, il tipo di terriccio e il nutrimento.
        </p>
      </div>

      @if (loading()) {
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Caricamento scheda...</p>
        </div>
      } @else {
        <form (ngSubmit)="savePlant()" class="editor-form">
          <!-- 1. Informazioni Generali -->
          <div class="glass-panel form-card">
            <h2 class="card-section-title">Informazioni Generali</h2>
            <div class="form-grid">
              <div class="form-group col-span-2">
                <label>Nome Comune *</label>
                <input
                  type="text"
                  class="input-field"
                  placeholder="Es: Monstera Deliciosa, Pothos, Sansevieria..."
                  [(ngModel)]="plantData.commonName"
                  name="commonName"
                  required
                />
              </div>

              <div class="form-group col-span-2">
                <label>Nome Botanico / Scientifico (Opzionale)</label>
                <input
                  type="text"
                  class="input-field"
                  placeholder="Es: Monstera deliciosa Liebm., Epipremnum aureum..."
                  [(ngModel)]="plantData.scientificName"
                  name="scientificName"
                />
              </div>
            </div>
          </div>

          <!-- 2. Foto & Galleria -->
          <div class="glass-panel form-card">
            <div class="card-title-row">
              <h2 class="card-section-title">Fotografie</h2>
              <input
                type="file"
                #fileInput
                accept="image/*"
                multiple
                style="display: none"
                (change)="onFilesSelected($event)"
              />
              <button
                type="button"
                class="btn btn-outline"
                [disabled]="uploadingPhoto()"
                (click)="fileInput.click()"
              >
                @if (uploadingPhoto()) {
                  <span>Caricamento...</span>
                } @else {
                  <span>+ Aggiungi Foto</span>
                }
              </button>
            </div>

            @if (attachments().length === 0) {
              <div class="empty-photos" (click)="fileInput.click()">
                <span class="upload-icon">📷</span>
                <p>Nessuna foto allegata. Clicca per caricare una o più immagini della pianta.</p>
              </div>
            } @else {
              <div class="photos-grid">
                @for (att of attachments(); track att.id; let idx = $index) {
                  <div class="photo-card">
                    <img [src]="'/api/attachments/' + att.id + '/preview'" alt="Foto Pianta" />
                    @if (idx === 0) {
                      <div class="cover-tag">Copertina</div>
                    }
                    <button
                      type="button"
                      class="btn-delete-photo"
                      (click)="removeAttachment(att.id)"
                      title="Rimuovi foto"
                    >
                      ✕
                    </button>
                  </div>
                }
              </div>
            }
          </div>

          <!-- 3. Calendario Cure Stagionali -->
          <div class="glass-panel form-card">
            <h2 class="card-section-title">Fabbisogno Stagionale (Innaffiature & Esposizione)</h2>
            <p class="section-desc">
              Imposta per ogni stagione la frequenza d'innaffiatura consigliata e l'esposizione alla luce solare.
            </p>
            <app-season-tabs
              [seasonalCare]="plantData.seasonalCare || null"
              [editMode]="true"
              (seasonalCareChange)="onSeasonalCareChange($event)"
            />
          </div>

          <!-- 4. Terriccio, Vaso e Rinvaso -->
          <div class="glass-panel form-card">
            <h2 class="card-section-title">Terriccio, Vaso & Rinvaso</h2>
            <div class="form-grid">
              <div class="form-group">
                <label>Stagione migliore per il rinvaso</label>
                <select
                  class="input-field"
                  [(ngModel)]="plantData.soilRepotting.repottingSeason"
                  name="repottingSeason"
                >
                  <option value="spring">Primavera (Consigliata)</option>
                  <option value="summer">Estate</option>
                  <option value="autumn">Autunno</option>
                  <option value="winter">Inverno</option>
                  <option value="any">Qualsiasi momento</option>
                </select>
              </div>

              <div class="form-group">
                <label>Vaso consigliato</label>
                <input
                  type="text"
                  class="input-field"
                  placeholder="Es: Terracotta con foro di drenaggio, Plastica trasparente"
                  [(ngModel)]="plantData.soilRepotting.potType"
                  name="potType"
                />
              </div>

              <div class="form-group col-span-2">
                <label>Tipo di terriccio</label>
                <input
                  type="text"
                  class="input-field"
                  placeholder="Es: Substrato per piante verdi, Mix per piante grasse/cactacee"
                  [(ngModel)]="plantData.soilRepotting.soilType"
                  name="soilType"
                />
              </div>

              <div class="form-group col-span-2">
                <label>Composizione & Materiali di drenaggio</label>
                <textarea
                  class="input-field textarea"
                  rows="2"
                  placeholder="Es: 60% terriccio universale, 20% perlite, 20% corteccia di pino (bark)"
                  [(ngModel)]="plantData.soilRepotting.composition"
                  name="composition"
                ></textarea>
              </div>
            </div>
          </div>

          <!-- 5. Concimazione -->
          <div class="glass-panel form-card">
            <h2 class="card-section-title">Concimazione & Nutrimento</h2>
            <div class="form-grid">
              <div class="form-group">
                <label>Periodo di somministrazione</label>
                <input
                  type="text"
                  class="input-field"
                  placeholder="Es: Da marzo a ottobre"
                  [(ngModel)]="plantData.fertilization.period"
                  name="fertPeriod"
                />
              </div>

              <div class="form-group">
                <label>Frequenza (ogni quanti giorni)</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  class="input-field"
                  placeholder="Es: 14"
                  [(ngModel)]="plantData.fertilization.frequencyDays"
                  name="fertFrequency"
                />
              </div>

              <div class="form-group col-span-2">
                <label>Tipo di concime</label>
                <input
                  type="text"
                  class="input-field"
                  placeholder="Es: Liquido per piante verdi NPK 7-3-6, Concime a lenta cessione"
                  [(ngModel)]="plantData.fertilization.fertilizerType"
                  name="fertType"
                />
              </div>

              <div class="form-group col-span-2">
                <label>Note e precauzioni concimazione</label>
                <textarea
                  class="input-field textarea"
                  rows="2"
                  placeholder="Es: Dimezzare le dosi rispetto all'etichetta; non concimare mai su terreno completamente asciutto"
                  [(ngModel)]="plantData.fertilization.notes"
                  name="fertNotes"
                ></textarea>
              </div>
            </div>
          </div>

          <!-- Action bar bottom -->
          <div class="bottom-actions-bar">
            <button type="button" class="btn btn-outline" (click)="cancel()">
              Annulla
            </button>
            <button
              type="submit"
              class="btn btn-primary btn-lg"
              [disabled]="!plantData.commonName?.trim() || saving()"
            >
              @if (saving()) {
                <span class="spinner-sm"></span>
                <span>Salvataggio...</span>
              } @else {
                <span>{{ isEditing() ? 'Salva Modifiche Scheda' : 'Crea Scheda Botanica' }}</span>
              }
            </button>
          </div>
        </form>
      }
    </div>
  `,
  styles: [`
    .page-container {
      max-width: 900px;
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
    .editor-header {
      margin-bottom: 2rem;
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
    .editor-form {
      display: flex;
      flex-direction: column;
      gap: 1.75rem;
    }
    .form-card {
      padding: 1.75rem 2rem;
      border-radius: var(--radius-lg);
    }
    .card-section-title {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--text-main);
      margin: 0 0 1.25rem 0;
    }
    .card-title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.25rem;
    }
    .card-title-row .card-section-title {
      margin-bottom: 0;
    }
    .section-desc {
      font-size: 0.92rem;
      color: var(--text-muted);
      margin: -0.5rem 0 1.25rem 0;
    }
    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem;
    }
    .col-span-2 {
      grid-column: span 2;
    }
    .empty-photos {
      border: 2px dashed var(--border-strong);
      border-radius: var(--radius-md);
      padding: 2.5rem 1.5rem;
      text-align: center;
      cursor: pointer;
      color: var(--text-muted);
      transition: all 0.2s ease;
    }
    .empty-photos:hover {
      border-color: var(--color-primary);
      background: var(--color-primary-subtle);
    }
    .upload-icon {
      font-size: 2.5rem;
      display: block;
      margin-bottom: 0.5rem;
    }
    .photos-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 1rem;
    }
    .photo-card {
      position: relative;
      width: 100%;
      height: 120px;
      border-radius: var(--radius-md);
      overflow: hidden;
      box-shadow: var(--shadow-sm);
    }
    .photo-card img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .cover-tag {
      position: absolute;
      bottom: 4px;
      left: 4px;
      background: rgba(16, 185, 129, 0.9);
      color: #fff;
      font-size: 0.7rem;
      font-weight: 700;
      padding: 0.15rem 0.4rem;
      border-radius: var(--radius-sm);
    }
    .btn-delete-photo {
      position: absolute;
      top: 4px;
      right: 4px;
      background: rgba(0, 0, 0, 0.6);
      color: #fff;
      border: none;
      border-radius: 50%;
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 0.75rem;
    }
    .bottom-actions-bar {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 1rem;
      margin-top: 1rem;
      padding-bottom: 2rem;
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
    .spinner-sm {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: #fff;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    @media (max-width: 640px) {
      .form-grid {
        grid-template-columns: 1fr;
      }
      .col-span-2 {
        grid-column: span 1;
      }
    }
  `],
})
export class PlantEditorComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
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

  loadExistingPlant(id: string) {
    this.loading.set(true);
    this.api.getPlant(id).subscribe({
      next: (pl) => {
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
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Errore nel caricamento della pianta');
        this.loading.set(false);
        this.router.navigate(['/plants']);
      },
    });
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

  savePlant() {
    if (!this.plantData.commonName.trim()) return;

    this.saving.set(true);
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

    if (this.isEditing() && this.plantId) {
      this.api.updatePlant(this.plantId, payload).subscribe({
        next: (updated) => {
          this.toast.success('Scheda botanica aggiornata');
          this.saving.set(false);
          this.router.navigate(['/plants', updated.id]);
        },
        error: () => {
          this.toast.error('Errore durante l’aggiornamento');
          this.saving.set(false);
        },
      });
    } else {
      this.api.createPlant(payload).subscribe({
        next: (created) => {
          this.toast.success('Nuova pianta aggiunta al catalogo');
          this.saving.set(false);
          this.router.navigate(['/plants', created.id]);
        },
        error: () => {
          this.toast.error('Errore durante la creazione della scheda');
          this.saving.set(false);
        },
      });
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

