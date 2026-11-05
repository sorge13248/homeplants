import { PlantItem } from './models';

export function getWateringFrequencyDays(plant?: PlantItem | null, customFreq?: number | null): number {
  if (customFreq && customFreq > 0) return customFreq;
  const sc = plant?.seasonalCare;
  if (!sc) return 7;
  const month = new Date().getMonth();
  let schedule = sc.spring;
  if (month >= 5 && month <= 7) schedule = sc.summer;
  else if (month >= 8 && month <= 10) schedule = sc.autumn;
  else if (month >= 11 || month <= 1) schedule = sc.winter;
  return schedule?.watering?.frequencyDays || 7;
}

export function computeNextWateringDate(wateredAt: Date | string, frequencyDays: number): string {
  const d = new Date(wateredAt);
  d.setDate(d.getDate() + frequencyDays);
  return d.toISOString();
}

