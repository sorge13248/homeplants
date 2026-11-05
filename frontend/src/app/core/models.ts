export interface AuthUser {
  id: string;
  subject: string;
  email: string | null;
  displayName: string;
  pictureUrl: string | null;
}

export interface OidcConfig {
  issuerUrl: string;
  clientId: string;
  redirectUri: string;
}

export interface UserSettings {
  id?: string;
  userId?: string;
  preferredMapProvider: 'osm' | 'google' | 'apple' | 'bing';
  themePreference: 'system' | 'light' | 'dark';
  emailNotificationsEnabled: boolean;
  notificationTime: string;
}

export interface AttachmentItem {
  id: string;
  fileName: string;
  originalName?: string | null;
  mimeType: string;
  size: number;
  path: string;
  previewPath?: string | null;
  plantId?: string | null;
  spaceId?: string | null;
  roomId?: string | null;
  sortOrder?: number;
}

export interface SeasonCareSchedule {
  sunExposure?: 'direct' | 'indirect' | 'filtered' | 'shade';
  placement?: 'indoor' | 'outdoor' | 'greenhouse';
  watering?: {
    frequencyDays?: number;
    quantity?: 'low' | 'moderate' | 'abundant';
    drySoilOnly?: boolean;
    advices?: string;
  };
}

export interface PlantSeasonalCare {
  spring?: SeasonCareSchedule;
  summer?: SeasonCareSchedule;
  autumn?: SeasonCareSchedule;
  winter?: SeasonCareSchedule;
}

export interface SoilRepottingCare {
  repottingSeason?: 'spring' | 'summer' | 'autumn' | 'winter' | 'any';
  potType?: string;
  soilType?: string;
  composition?: string;
}

export interface FertilizationCare {
  period?: string;
  frequencyDays?: number;
  fertilizerType?: string;
  notes?: string;
}

export interface PlantItem {
  id: string;
  userId?: string;
  commonName: string;
  scientificName?: string | null;
  seasonalCare?: PlantSeasonalCare | null;
  soilRepotting?: SoilRepottingCare | null;
  fertilization?: FertilizationCare | null;
  attachments?: AttachmentItem[];
  roomPlants?: RoomPlantItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SpaceItem {
  id: string;
  userId?: string;
  name: string;
  location?: string | null;
  description?: string | null;
  coverPhotoUrl?: string | null;
  rooms?: RoomItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface RoomItem {
  id: string;
  userId?: string;
  spaceId: string;
  space?: SpaceItem;
  name: string;
  description?: string | null;
  coverPhotoUrl?: string | null;
  roomPlants?: RoomPlantItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface WateringLogItem {
  id: string;
  roomPlantId: string;
  wateredAt: string;
  notes?: string | null;
  source?: 'web' | 'email-quick-action' | 'bulk-room';
}

export interface RoomPlantItem {
  id: string;
  userId?: string;
  roomId: string;
  room?: RoomItem;
  plantId: string;
  plant?: PlantItem;
  position?: string | null;
  customFrequencyDays?: number | null;
  lastWateredAt?: string | null;
  nextWateringDueAt?: string | null;
  snoozedUntil?: string | null;
  notes?: string | null;
  wateringLogs?: WateringLogItem[];
  createdAt?: string;
  updatedAt?: string;
}

export type SyncStatus = 'online-ok' | 'syncing' | 'offline' | 'conflict';

export interface SyncQueueItem {
  id: string;
  entityType: 'spaces' | 'rooms' | 'plants' | 'room_plants' | 'settings' | 'watering_logs';
  action: 'create' | 'update' | 'delete';
  payload: any;
  queuedAt: string;
}

export interface SyncConflict {
  entityType: string;
  entityId: string;
  field: string;
  clientValue: unknown;
  serverValue: unknown;
  resolution: string;
  message: string;
}

