import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlantSeasonalCare, SeasonCareSchedule, SoilRepottingCare, FertilizationCare } from '../../../core/models';

type SeasonKey = 'spring' | 'summer' | 'autumn' | 'winter';

@Component({
  selector: 'app-season-tabs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="season-tabs-container">
      <!-- Tabs header -->
      <div class="tabs-nav">
        <button
          type="button"
          class="tab-btn"
          [class.active]="activeTab === 'spring'"
          (click)="activeTab = 'spring'"
        >
          🌸 Primavera
        </button>
        <button
          type="button"
          class="tab-btn"
          [class.active]="activeTab === 'summer'"
          (click)="activeTab = 'summer'"
        >
          ☀️ Estate
        </button>
        <button
          type="button"
          class="tab-btn"
          [class.active]="activeTab === 'autumn'"
          (click)="activeTab = 'autumn'"
        >
          🍂 Autunno
        </button>
        <button
          type="button"
          class="tab-btn"
          [class.active]="activeTab === 'winter'"
          (click)="activeTab = 'winter'"
        >
          ❄️ Inverno
        </button>
      </div>

      <!-- Tab content -->
      <div class="tab-panel glass-panel">
        @if (editMode) {
          <!-- Edit Form -->
          <div class="form-grid">
            <div class="form-group">
              <label>Esposizione Sole / Luce</label>
              <select class="input-field" [(ngModel)]="currentSchedule.sunExposure" (ngModelChange)="onModelChange()">
                <option [ngValue]="undefined">Non specificato</option>
                <option value="direct">Luce Diretta</option>
                <option value="indirect">Luce Indiretta Luminosa</option>
                <option value="filtered">Luce Filtrata</option>
                <option value="shade">Mezz'ombra / Ombra</option>
              </select>
            </div>

            <div class="form-group">
              <label>Collocazione</label>
              <select class="input-field" [(ngModel)]="currentSchedule.placement" (ngModelChange)="onModelChange()">
                <option [ngValue]="undefined">Non specificato</option>
                <option value="indoor">Interno</option>
                <option value="outdoor">Esterno</option>
                <option value="greenhouse">Serra / Riparato</option>
              </select>
            </div>

            <div class="form-group">
              <label>Frequenza innaffiatura (ogni quanti giorni?)</label>
              <input
                type="number"
                min="1"
                max="60"
                class="input-field"
                placeholder="es. 3 (ogni 3 giorni)"
                [(ngModel)]="currentWatering.frequencyDays"
                (ngModelChange)="onModelChange()"
              />
            </div>

            <div class="form-group">
              <label>Quantità d'acqua</label>
              <select class="input-field" [(ngModel)]="currentWatering.quantity" (ngModelChange)="onModelChange()">
                <option [ngValue]="undefined">Non specificata</option>
                <option value="low">Scarsa (vaporizzazione o poca)</option>
                <option value="moderate">Moderata</option>
                <option value="abundant">Abbondante (bagno completo)</option>
              </select>
            </div>

            <div class="form-group full-width">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  [(ngModel)]="currentWatering.drySoilOnly"
                  (ngModelChange)="onModelChange()"
                />
                <span>Innaffiare solo a terriccio completamente asciutto</span>
              </label>
            </div>

            <div class="form-group full-width">
              <label>Consigli specifici per l'innaffiatura (es. orario o ombra)</label>
              <input
                type="text"
                class="input-field"
                placeholder="es. Innaffiare solo quando all'ombra o al mattino presto"
                [(ngModel)]="currentWatering.advices"
                (ngModelChange)="onModelChange()"
              />
            </div>
          </div>
        } @else {
          <!-- View Display -->
          @if (hasDataForCurrentSeason()) {
            <div class="view-grid">
              <div class="info-card">
                <div class="info-label">Esposizione Luce</div>
                <div class="info-val">{{ getSunExposureLabel(currentSchedule.sunExposure) }}</div>
              </div>
              <div class="info-card">
                <div class="info-label">Collocazione</div>
                <div class="info-val">{{ getPlacementLabel(currentSchedule.placement) }}</div>
              </div>
              <div class="info-card">
                <div class="info-label">Frequenza Innaffiatura</div>
                <div class="info-val">
                  {{ currentSchedule.watering?.frequencyDays ? 'Ogni ' + currentSchedule.watering?.frequencyDays + ' giorni' : 'Non specificata' }}
                </div>
              </div>
              <div class="info-card">
                <div class="info-label">Quantità</div>
                <div class="info-val">{{ getQuantityLabel(currentSchedule.watering?.quantity) }}</div>
              </div>

              @if (currentSchedule.watering?.drySoilOnly) {
                <div class="info-alert full-width">
                  ⚠️ Innaffiare solo quando il terriccio è asciutto in superficie.
                </div>
              }

              @if (currentSchedule.watering?.advices) {
                <div class="info-advices full-width">
                  💡 <strong>Consiglio:</strong> {{ currentSchedule.watering?.advices }}
                </div>
              }
            </div>
          } @else {
            <div class="empty-season">
              Nessuna informazione specifica registrata per la stagione {{ getSeasonName(activeTab) }}.
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .season-tabs-container {
      margin-top: 1rem;
    }
    .tabs-nav {
      display: flex;
      gap: 0.5rem;
      overflow-x: auto;
      padding-bottom: 0.5rem;
      scrollbar-width: none;
    }
    .tab-btn {
      padding: 0.55rem 1rem;
      background: var(--bg-surface-translucent);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      color: var(--text-main);
      font-size: 0.88rem;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s;

      &:hover {
        background: var(--bg-surface);
      }
      &.active {
        background: var(--color-primary);
        color: #ffffff;
        border-color: var(--color-primary);
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
      }
    }
    .tab-panel {
      padding: 1.5rem;
      margin-top: 0.5rem;
    }
    .form-grid, .view-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.25rem;
    }
    .full-width {
      grid-column: 1 / -1;
    }
    .form-group {
      label {
        display: block;
        font-size: 0.82rem;
        font-weight: 600;
        margin-bottom: 0.4rem;
        color: var(--text-main);
      }
    }
    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9rem;
      cursor: pointer;
    }
    .info-card {
      background: rgba(16, 185, 129, 0.05);
      border: 1px solid var(--border-subtle);
      padding: 1rem;
      border-radius: var(--radius-md);
    }
    .info-label {
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 0.25rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .info-val {
      font-size: 1rem;
      font-weight: 700;
      color: var(--text-main);
    }
    .info-alert {
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.3);
      color: var(--color-warning);
      padding: 0.75rem 1rem;
      border-radius: var(--radius-md);
      font-size: 0.9rem;
      font-weight: 500;
    }
    .info-advices {
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: var(--color-primary);
      padding: 0.75rem 1rem;
      border-radius: var(--radius-md);
      font-size: 0.9rem;
    }
    .empty-season {
      text-align: center;
      padding: 2rem;
      color: var(--text-muted);
      font-size: 0.95rem;
    }
  `],
})
export class SeasonTabsComponent {
  @Input() seasonalCare: PlantSeasonalCare | null = null;
  @Input() editMode = false;
  @Output() seasonalCareChange = new EventEmitter<PlantSeasonalCare>();

  activeTab: SeasonKey = 'spring';

  get currentSchedule(): SeasonCareSchedule {
    if (!this.seasonalCare) {
      this.seasonalCare = {};
    }
    if (!this.seasonalCare[this.activeTab]) {
      this.seasonalCare[this.activeTab] = {};
    }
    return this.seasonalCare[this.activeTab]!;
  }

  get currentWatering() {
    if (!this.currentSchedule.watering) {
      this.currentSchedule.watering = {};
    }
    return this.currentSchedule.watering;
  }

  hasDataForCurrentSeason(): boolean {
    const s = this.seasonalCare?.[this.activeTab];
    if (!s) return false;
    return Boolean(
      s.sunExposure ||
      s.placement ||
      s.watering?.frequencyDays ||
      s.watering?.quantity ||
      s.watering?.drySoilOnly ||
      s.watering?.advices
    );
  }

  onModelChange() {
    this.seasonalCareChange.emit(this.seasonalCare!);
  }

  getSeasonName(key: SeasonKey): string {
    switch (key) {
      case 'spring': return 'primaverile';
      case 'summer': return 'estiva';
      case 'autumn': return 'autunnale';
      case 'winter': return 'invernale';
    }
  }

  getSunExposureLabel(val?: string): string {
    switch (val) {
      case 'direct': return 'Luce Diretta';
      case 'indirect': return 'Luce Indiretta Luminosa';
      case 'filtered': return 'Luce Filtrata';
      case 'shade': return 'Mezz\'ombra / Ombra';
      default: return 'Non specificato';
    }
  }

  getPlacementLabel(val?: string): string {
    switch (val) {
      case 'indoor': return 'Interno';
      case 'outdoor': return 'Esterno';
      case 'greenhouse': return 'Serra';
      default: return 'Non specificato';
    }
  }

  getQuantityLabel(val?: string): string {
    switch (val) {
      case 'low': return 'Scarsa';
      case 'moderate': return 'Moderata';
      case 'abundant': return 'Abbondante';
      default: return 'Non specificata';
    }
  }
}

