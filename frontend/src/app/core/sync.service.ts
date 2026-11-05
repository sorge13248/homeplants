import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import {
  FieldUpdate,
  PlantItem,
  RoomItem,
  RoomPlantItem,
  SpaceItem,
  SyncConflict,
  SyncPayloadDto,
  SyncQueueItem,
  SyncResponseDto,
  SyncStatus,
  UserSettings,
  WateringLogItem,
} from './models';
import { OfflineStorageService } from './offline-storage.service';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly api = inject(ApiService);
  private readonly storage = inject(OfflineStorageService);
  private readonly toast = inject(ToastService, { optional: true });

  readonly status = signal<SyncStatus>('online-ok');
  readonly conflicts = signal<SyncConflict[]>([]);
  readonly isOnline = signal<boolean>(typeof navigator !== 'undefined' && navigator.onLine !== undefined ? navigator.onLine : true);
  readonly pendingCount = signal<number>(0);
  readonly lastSyncTime = signal<Date | null>(null);
  readonly dataUpdated = signal<number>(0);

  private activeSyncPromise: Promise<SyncResponseDto | null> | null = null;
  private initPromise: Promise<void> | null = null;
  private startupToastShown = false;
  private probeInterval: ReturnType<typeof setInterval> | null = null;
  private syncScheduled = false;

  readonly isSyncing = computed(() => this.status() === 'syncing');
  readonly isConflict = computed(() => this.status() === 'conflict');
  readonly isOffline = computed(() => !this.isOnline() || this.status() === 'offline');
  readonly isOk = computed(() => this.isOnline() && this.status() === 'online-ok');

  constructor() {
    this.init();
  }

  notifyDataChanged(): void {
    this.dataUpdated.update((n) => n + 1);
  }

  showStartupToastIfFirst(): void {
    if (!this.startupToastShown) {
      this.startupToastShown = true;
      this.toast?.success('Sincronizzazione completata');
    }
  }

  isOfflineError(err: unknown): boolean {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return true;
    }
    if (err instanceof HttpErrorResponse) {
      return err.status === 0;
    }
    if (err && typeof err === 'object') {
      if ('status' in err && (err as { status: number }).status === 0) {
        return true;
      }
      const msg = String((err as { message?: string }).message || '').toLowerCase();
      if (msg.includes('offline') || msg.includes('network error') || msg.includes('failed to fetch')) {
        return true;
      }
    }
    return false;
  }

  markOffline(): void {
    this.isOnline.set(false);
    this.status.set('offline');
    this.conflicts.set([]);
    this.startHealthProbe();
  }

  markOnline(): void {
    this.isOnline.set(true);
    this.stopHealthProbe();
    void this.sync();
  }

  checkIsOffline(): boolean {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return true;
    }
    return !this.isOnline() || this.status() === 'offline';
  }

  private startHealthProbe(): void {
    if (this.probeInterval || typeof window === 'undefined') return;
    this.probeInterval = setInterval(async () => {
      try {
        const res = await fetch('/health', { method: 'GET', cache: 'no-store' });
        if (res.ok) {
          this.markOnline();
        }
      } catch {
        // Still offline
      }
    }, 5000);
  }

  private stopHealthProbe(): void {
    if (this.probeInterval) {
      clearInterval(this.probeInterval);
      this.probeInterval = null;
    }
  }

  init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.doInit();
    }
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    if (typeof window !== 'undefined') {
      this.isOnline.set(navigator.onLine ?? true);
      if (navigator.onLine === false) {
        this.status.set('offline');
      }

      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.handleOffline());
    }

    try {
      const meta = await this.storage.getMetadata();
      if (meta.lastSyncAt) {
        this.lastSyncTime.set(new Date(meta.lastSyncAt));
      }
      if (meta.conflicts && meta.conflicts.length > 0) {
        this.conflicts.set(meta.conflicts);
        this.status.set('conflict');
      } else if (!this.isOnline()) {
        this.status.set('offline');
      } else {
        this.status.set(meta.lastSyncStatus === 'conflict' ? 'conflict' : 'online-ok');
      }

      const queue = await this.storage.getQueue();
      this.pendingCount.set(queue.length);

      const localSpaces = await this.storage.getAllSpaces();
      if (this.isOnline()) {
        try {
          const res = localSpaces.length === 0 ? await this.sync(true) : await this.sync();
          if (res) {
            this.showStartupToastIfFirst();
          }
        } catch {
          // Storage init graceful fallback
        }
      }
    } catch {
      // ignore
    }
  }

  private handleOnline(): void {
    this.isOnline.set(true);
    this.stopHealthProbe();
    void this.sync();
  }

  private handleOffline(): void {
    this.markOffline();
  }

  async sync(forceFullSync = false): Promise<SyncResponseDto | null> {
    if (!this.isOnline() || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
      this.markOffline();
      return null;
    }

    if (this.activeSyncPromise) {
      this.syncScheduled = true;
      return this.activeSyncPromise;
    }

    this.activeSyncPromise = (async () => {
      try {
        return await this.executeSync(forceFullSync);
      } finally {
        this.activeSyncPromise = null;
        if (this.syncScheduled) {
          this.syncScheduled = false;
          void this.sync();
        }
      }
    })();

    return this.activeSyncPromise;
  }

  async downloadServerVersion(): Promise<SyncResponseDto | null> {
    if (!this.isOnline() || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
      this.markOffline();
      return null;
    }

    if (this.activeSyncPromise) {
      return this.activeSyncPromise;
    }

    this.activeSyncPromise = this.executeDownloadServerVersion();
    try {
      return await this.activeSyncPromise;
    } finally {
      this.activeSyncPromise = null;
    }
  }

  private async executeDownloadServerVersion(): Promise<SyncResponseDto | null> {
    this.status.set('syncing');

    try {
      await this.storage.clearAll();
      this.pendingCount.set(0);

      const payload: SyncPayloadDto = {
        lastSyncAt: null,
        clientTime: new Date().toISOString(),
        changes: {
          spaces: [],
          rooms: [],
          plants: [],
          roomPlants: [],
          wateringLogs: [],
        },
      };

      const response = await firstValueFrom(this.api.sync(payload));

      if (response.serverChanges?.spaces?.length) {
        await this.storage.saveSpaces(response.serverChanges.spaces);
      }
      if (response.serverChanges?.rooms?.length) {
        await this.storage.saveRooms(response.serverChanges.rooms);
      }
      if (response.serverChanges?.plants?.length) {
        await this.storage.savePlants(response.serverChanges.plants);
      }
      if (response.serverChanges?.roomPlants?.length) {
        await this.storage.saveRoomPlants(response.serverChanges.roomPlants);
      }
      if (response.serverChanges?.settings) {
        await this.storage.saveSettings(response.serverChanges.settings);
      }

      this.conflicts.set([]);
      this.status.set('online-ok');
      const serverDate = new Date(response.serverTime);
      this.lastSyncTime.set(serverDate);

      await this.storage.setMetadata({
        lastSyncAt: response.serverTime,
        lastSyncStatus: 'online-ok',
        conflicts: [],
      });

      this.isOnline.set(true);
      this.stopHealthProbe();
      this.notifyDataChanged();
      return response;
    } catch (err) {
      if (this.isOfflineError(err)) {
        this.markOffline();
      } else {
        this.status.set('conflict');
      }
      return null;
    }
  }

  private async executeSync(forceFullSync = false): Promise<SyncResponseDto | null> {
    this.status.set('syncing');

    try {
      const meta = await this.storage.getMetadata();
      const queue = await this.storage.getQueue();
      this.pendingCount.set(queue.length);

      const lastSyncAt = forceFullSync ? null : meta.lastSyncAt;
      const payload = this.buildSyncPayload(lastSyncAt, queue);
      const response = await firstValueFrom(this.api.sync(payload));

      // Remove synced queue items
      const hadQueue = queue.length > 0;
      if (hadQueue) {
        await this.storage.removeQueueItems(queue.map((q) => q.id));
        const updatedQueue = await this.storage.getQueue();
        this.pendingCount.set(updatedQueue.length);
      }

      // Apply server changes to local storage
      let hasChanges = hadQueue;
      if (response.serverChanges) {
        const sc = response.serverChanges;

        if (sc.spaces?.length) {
          await this.storage.saveSpaces(sc.spaces);
          hasChanges = true;
        }
        if (sc.deletedSpaceIds?.length) {
          await this.storage.removeSpaces(sc.deletedSpaceIds);
          hasChanges = true;
        }

        if (sc.rooms?.length) {
          await this.storage.saveRooms(sc.rooms);
          hasChanges = true;
        }
        if (sc.deletedRoomIds?.length) {
          await this.storage.removeRooms(sc.deletedRoomIds);
          hasChanges = true;
        }

        if (sc.plants?.length) {
          await this.storage.savePlants(sc.plants);
          hasChanges = true;
        }
        if (sc.deletedPlantIds?.length) {
          await this.storage.removePlants(sc.deletedPlantIds);
          hasChanges = true;
        }

        if (sc.roomPlants?.length) {
          await this.storage.saveRoomPlants(sc.roomPlants);
          hasChanges = true;
        }
        if (sc.deletedRoomPlantIds?.length) {
          await this.storage.removeRoomPlants(sc.deletedRoomPlantIds);
          hasChanges = true;
        }

        if (sc.settings) {
          await this.storage.saveSettings(sc.settings);
          hasChanges = true;
        }

        if (hasChanges) {
          this.notifyDataChanged();
        }
      }

      // Check conflicts
      const hasConflicts = response.conflicts && response.conflicts.length > 0;
      if (hasConflicts) {
        this.conflicts.set(response.conflicts);
        this.status.set('conflict');
      } else {
        this.conflicts.set([]);
        this.status.set('online-ok');
      }

      const serverDate = new Date(response.serverTime);
      this.lastSyncTime.set(serverDate);

      await this.storage.setMetadata({
        lastSyncAt: response.serverTime,
        lastSyncStatus: hasConflicts ? 'conflict' : 'online-ok',
        conflicts: response.conflicts ?? [],
      });

      this.isOnline.set(true);
      this.stopHealthProbe();
      return response;
    } catch (err) {
      if (this.isOfflineError(err)) {
        this.markOffline();
      } else {
        this.status.set('conflict');
      }
      return null;
    }
  }

  private buildSyncPayload(lastSyncAt: string | null, queue: SyncQueueItem[]): SyncPayloadDto {
    const spacesMap = new Map<string, any>();
    const roomsMap = new Map<string, any>();
    const plantsMap = new Map<string, any>();
    const roomPlantsMap = new Map<string, any>();
    const wateringLogs: any[] = [];
    let settingsInput: any = undefined;

    for (const item of queue) {
      if (item.entityType === 'spaces') {
        const existing = spacesMap.get(item.entityId) ?? {
          id: item.entityId,
          updatedAt: item.updatedAt,
          deleted: false,
          fields: {},
          data: {},
        };
        if (item.action === 'delete') {
          existing.deleted = true;
          existing.updatedAt = item.updatedAt;
        } else {
          existing.deleted = false;
          existing.updatedAt = item.updatedAt;
          if (item.data) {
            existing.data = { ...(existing.data ?? {}), ...item.data };
            Object.assign(existing, item.data);
          }
          if (item.fields) {
            existing.fields = { ...(existing.fields ?? {}), ...item.fields };
          }
        }
        spacesMap.set(item.entityId, existing);
      } else if (item.entityType === 'rooms') {
        const existing = roomsMap.get(item.entityId) ?? {
          id: item.entityId,
          updatedAt: item.updatedAt,
          deleted: false,
          fields: {},
          data: {},
        };
        if (item.action === 'delete') {
          existing.deleted = true;
          existing.updatedAt = item.updatedAt;
        } else {
          existing.deleted = false;
          existing.updatedAt = item.updatedAt;
          if (item.data) {
            existing.data = { ...(existing.data ?? {}), ...item.data };
            Object.assign(existing, item.data);
          }
          if (item.fields) {
            existing.fields = { ...(existing.fields ?? {}), ...item.fields };
          }
        }
        roomsMap.set(item.entityId, existing);
      } else if (item.entityType === 'plants') {
        const existing = plantsMap.get(item.entityId) ?? {
          id: item.entityId,
          updatedAt: item.updatedAt,
          deleted: false,
          fields: {},
          data: {},
        };
        if (item.action === 'delete') {
          existing.deleted = true;
          existing.updatedAt = item.updatedAt;
        } else {
          existing.deleted = false;
          existing.updatedAt = item.updatedAt;
          if (item.data) {
            existing.data = { ...(existing.data ?? {}), ...item.data };
            Object.assign(existing, item.data);
          }
          if (item.fields) {
            existing.fields = { ...(existing.fields ?? {}), ...item.fields };
          }
        }
        plantsMap.set(item.entityId, existing);
      } else if (item.entityType === 'room_plants') {
        const existing = roomPlantsMap.get(item.entityId) ?? {
          id: item.entityId,
          updatedAt: item.updatedAt,
          deleted: false,
          fields: {},
          data: {},
        };
        if (item.action === 'delete') {
          existing.deleted = true;
          existing.updatedAt = item.updatedAt;
        } else {
          existing.deleted = false;
          existing.updatedAt = item.updatedAt;
          if (item.data) {
            existing.data = { ...(existing.data ?? {}), ...item.data };
            Object.assign(existing, item.data);
          }
          if (item.fields) {
            existing.fields = { ...(existing.fields ?? {}), ...item.fields };
          }
        }
        roomPlantsMap.set(item.entityId, existing);
      } else if (item.entityType === 'watering_logs' && item.data) {
        wateringLogs.push({
          id: item.data['id'] as string,
          roomPlantId: item.data['roomPlantId'] as string,
          wateredAt: (item.data['wateredAt'] as string) || item.updatedAt,
          notes: (item.data['notes'] as string) || null,
          source: (item.data['source'] as any) || 'web',
        });
      } else if (item.entityType === 'settings' && item.data) {
        settingsInput = {
          ...(settingsInput ?? {}),
          ...item.data,
          updatedAt: item.updatedAt,
        };
      }
    }

    return {
      lastSyncAt,
      clientTime: new Date().toISOString(),
      changes: {
        spaces: Array.from(spacesMap.values()),
        rooms: Array.from(roomsMap.values()),
        plants: Array.from(plantsMap.values()),
        roomPlants: Array.from(roomPlantsMap.values()),
        wateringLogs: wateringLogs.length ? wateringLogs : undefined,
        settings: settingsInput,
      },
    };
  }

  // ==========================================
  // Mutation recording methods
  // Writes only to IndexedDB queue and triggers sync() immediately
  // ==========================================
  async queueSpaceChange(
    spaceId: string,
    action: 'create' | 'update' | 'delete',
    fields?: any,
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const formattedFields: Record<string, FieldUpdate> = {};
    if (fields) {
      for (const [k, v] of Object.entries(fields)) {
        formattedFields[k] = { value: v, updatedAt: timestamp };
      }
    }

    const queueItem: SyncQueueItem = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `queue_${Date.now()}_${Math.random()}`,
      entityType: 'spaces',
      action,
      entityId: spaceId,
      updatedAt: timestamp,
      fields: formattedFields,
      data: fields,
      deleted: action === 'delete',
    };

    await this.storage.enqueue(queueItem);
    this.pendingCount.update((count) => count + 1);
    this.notifyDataChanged();

    if (this.isOnline()) {
      void this.sync();
    }
  }

  async queueRoomChange(
    roomId: string,
    action: 'create' | 'update' | 'delete',
    fields?: any,
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const formattedFields: Record<string, FieldUpdate> = {};
    if (fields) {
      for (const [k, v] of Object.entries(fields)) {
        formattedFields[k] = { value: v, updatedAt: timestamp };
      }
    }

    const queueItem: SyncQueueItem = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `queue_${Date.now()}_${Math.random()}`,
      entityType: 'rooms',
      action,
      entityId: roomId,
      updatedAt: timestamp,
      fields: formattedFields,
      data: fields,
      deleted: action === 'delete',
    };

    await this.storage.enqueue(queueItem);
    this.pendingCount.update((count) => count + 1);
    this.notifyDataChanged();

    if (this.isOnline()) {
      void this.sync();
    }
  }

  async queuePlantChange(
    plantId: string,
    action: 'create' | 'update' | 'delete',
    fields?: any,
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const formattedFields: Record<string, FieldUpdate> = {};
    if (fields) {
      for (const [k, v] of Object.entries(fields)) {
        formattedFields[k] = { value: v, updatedAt: timestamp };
      }
    }

    const queueItem: SyncQueueItem = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `queue_${Date.now()}_${Math.random()}`,
      entityType: 'plants',
      action,
      entityId: plantId,
      updatedAt: timestamp,
      fields: formattedFields,
      data: fields,
      deleted: action === 'delete',
    };

    await this.storage.enqueue(queueItem);
    this.pendingCount.update((count) => count + 1);
    this.notifyDataChanged();

    if (this.isOnline()) {
      void this.sync();
    }
  }

  async queueRoomPlantChange(
    roomPlantId: string,
    action: 'create' | 'update' | 'delete',
    fields?: any,
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const formattedFields: Record<string, FieldUpdate> = {};
    if (fields) {
      for (const [k, v] of Object.entries(fields)) {
        formattedFields[k] = { value: v, updatedAt: timestamp };
      }
    }

    const queueItem: SyncQueueItem = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `queue_${Date.now()}_${Math.random()}`,
      entityType: 'room_plants',
      action,
      entityId: roomPlantId,
      updatedAt: timestamp,
      fields: formattedFields,
      data: fields,
      deleted: action === 'delete',
    };

    await this.storage.enqueue(queueItem);
    this.pendingCount.update((count) => count + 1);
    this.notifyDataChanged();

    if (this.isOnline()) {
      void this.sync();
    }
  }

  async queueWateringLog(log: WateringLogItem): Promise<void> {
    const timestamp = log.wateredAt || new Date().toISOString();
    const queueItem: SyncQueueItem = {
      id: log.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `queue_${Date.now()}_${Math.random()}`),
      entityType: 'watering_logs',
      action: 'create',
      entityId: log.id,
      updatedAt: timestamp,
      data: {
        id: log.id,
        roomPlantId: log.roomPlantId,
        wateredAt: log.wateredAt,
        notes: log.notes,
        source: log.source,
      },
    };

    await this.storage.enqueue(queueItem);
    this.pendingCount.update((count) => count + 1);
    this.notifyDataChanged();

    if (this.isOnline()) {
      void this.sync();
    }
  }

  async queueSettingsChange(settings: Partial<UserSettings>): Promise<void> {
    const timestamp = new Date().toISOString();
    const queueItem: SyncQueueItem = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `queue_${Date.now()}_${Math.random()}`,
      entityType: 'settings',
      action: 'update',
      entityId: 'user_settings',
      updatedAt: timestamp,
      data: settings,
    };

    await this.storage.enqueue(queueItem);
    this.pendingCount.update((count) => count + 1);
    this.notifyDataChanged();

    if (this.isOnline()) {
      void this.sync();
    }
  }
}
