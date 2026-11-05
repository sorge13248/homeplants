export interface FieldUpdate<T = unknown> {
  value: T;
  updatedAt?: string;
}

export interface SpaceSyncInput {
  id: string;
  updatedAt: string;
  deleted?: boolean;
  name?: string;
  location?: string | null;
  description?: string | null;
  coverPhotoUrl?: string | null;
  fields?: Record<string, FieldUpdate | unknown>;
  data?: Record<string, unknown>;
}

export interface RoomSyncInput {
  id: string;
  updatedAt: string;
  deleted?: boolean;
  spaceId?: string;
  name?: string;
  description?: string | null;
  coverPhotoUrl?: string | null;
  fields?: Record<string, FieldUpdate | unknown>;
  data?: Record<string, unknown>;
}

export interface PlantSyncInput {
  id: string;
  updatedAt: string;
  deleted?: boolean;
  commonName?: string;
  scientificName?: string | null;
  seasonalCare?: any | null;
  soilRepotting?: any | null;
  fertilization?: any | null;
  fields?: Record<string, FieldUpdate | unknown>;
  data?: Record<string, unknown>;
}

export interface RoomPlantSyncInput {
  id: string;
  updatedAt: string;
  deleted?: boolean;
  roomId?: string;
  plantId?: string;
  position?: string | null;
  customFrequencyDays?: number | null;
  lastWateredAt?: string | null;
  nextWateringDueAt?: string | null;
  snoozedUntil?: string | null;
  notes?: string | null;
  fields?: Record<string, FieldUpdate | unknown>;
  data?: Record<string, unknown>;
}

export interface UserSettingsSyncInput {
  preferredMapProvider?: 'osm' | 'google' | 'apple' | 'bing';
  themePreference?: 'system' | 'light' | 'dark';
  emailNotificationsEnabled?: boolean;
  notificationTime?: string;
  updatedAt?: string;
}

export interface WateringLogSyncInput {
  id?: string;
  roomPlantId: string;
  wateredAt: string;
  notes?: string | null;
  source?: 'web' | 'email-quick-action' | 'bulk-room';
}

export interface SyncPayloadDto {
  lastSyncAt?: string | null;
  clientTime?: string;
  changes?: {
    spaces?: SpaceSyncInput[];
    rooms?: RoomSyncInput[];
    plants?: PlantSyncInput[];
    roomPlants?: RoomPlantSyncInput[];
    settings?: UserSettingsSyncInput;
    wateringLogs?: WateringLogSyncInput[];
  };
}

export interface SyncConflict {
  entityType: 'space' | 'room' | 'plant' | 'roomPlant' | 'userSettings';
  entityId: string;
  field: string;
  clientValue: unknown;
  serverValue: unknown;
  clientTimestamp: string;
  serverTimestamp: string;
  resolution: 'client' | 'server' | 'unresolved';
  message: string;
}

export interface SyncResponseDto {
  serverTime: string;
  status: 'ok' | 'conflict';
  conflicts: SyncConflict[];
  applied: {
    spaces: string[];
    rooms: string[];
    plants: string[];
    roomPlants: string[];
    settings: boolean;
    wateringLogs: number;
  };
  serverChanges: {
    spaces: unknown[];
    deletedSpaceIds: string[];
    rooms: unknown[];
    deletedRoomIds: string[];
    plants: unknown[];
    deletedPlantIds: string[];
    roomPlants: unknown[];
    deletedRoomPlantIds: string[];
    settings?: unknown | null;
  };
}

