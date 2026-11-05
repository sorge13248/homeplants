import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlantSeasonalCare, SeasonCareSchedule, SoilRepottingCare, FertilizationCare } from '../../../core/models';

type SeasonKey = 'spring' | 'summer' | 'autumn' | 'winter';

@Component({
  selector: 'app-season-tabs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './season-tabs.component.html',
  styleUrl: './season-tabs.component.scss',
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

