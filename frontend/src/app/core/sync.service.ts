import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { OfflineStorageService } from './offline-storage.service';
import { SyncConflict, SyncQueueItem, SyncStatus } from './models';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly api = inject(ApiService);
  private readonly storage = inject(OfflineStorageService);
  private readonly toast = inject(ToastService);

  readonly isOnline = signal<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  readonly isSyncing = signal<boolean>(false);
  readonly pendingCount = signal<number>(0);
  readonly lastSyncTime = signal<Date | null>(null);
  readonly conflicts = signal<SyncConflict[]>([]);

  readonly status = computed<SyncStatus>(() => {
    if (!this.isOnline()) {
      return 'offline';
    }
    if (this.isSyncing()) {
      return 'syncing';
    }
    if (this.conflicts().length > 0) {
      return 'conflict';
    }
    return 'online-ok';
  });

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline.set(true);
        void this.sync();
      });
      window.addEventListener('offline', () => {
        this.isOnline.set(false);
      });
    }

    void this.initialize();
  }

  async initialize() {
    const meta = await this.storage.getMetadata();
    if (meta.lastSyncAt) {
      this.lastSyncTime.set(new Date(meta.lastSyncAt));
    }
    this.conflicts.set(meta.conflicts || []);
    await this.refreshPendingCount();

    if (this.isOnline()) {
      void this.sync();
    }
  }

  async refreshPendingCount() {
    const queue = await this.storage.getQueue();
    this.pendingCount.set(queue.length);
  }

  async sync(): Promise<void> {
    if (this.isSyncing() || !this.isOnline()) {
      return;
    }

    this.isSyncing.set(true);

    try {
      const meta = await this.storage.getMetadata();
      const queue = await this.storage.getQueue();

      // Aggregate queue items into changes
      const changes: any = {
        spaces: [],
        rooms: [],
        plants: [],
        roomPlants: [],
        wateringLogs: [],
      };

      for (const item of queue) {
        if (item.entityType === 'spaces') changes.spaces.push(item.payload);
        if (item.entityType === 'rooms') changes.rooms.push(item.payload);
        if (item.entityType === 'plants') changes.plants.push(item.payload);
        if (item.entityType === 'room_plants') changes.roomPlants.push(item.payload);
        if (item.entityType === 'watering_logs') changes.wateringLogs.push(item.payload);
        if (item.entityType === 'settings') changes.settings = item.payload;
      }

      const response = await firstValueFrom(
        this.api.sync({
          lastSyncAt: meta.lastSyncAt,
          clientTime: new Date().toISOString(),
          changes,
        }),
      );

      // Apply server changes to local IndexedDB
      if (response.serverChanges) {
        const sc = response.serverChanges;
        if (sc.spaces?.length) await this.storage.saveSpaces(sc.spaces);
        if (sc.deletedSpaceIds?.length) await this.storage.removeSpaces(sc.deletedSpaceIds);

        if (sc.rooms?.length) await this.storage.saveRooms(sc.rooms);
        if (sc.deletedRoomIds?.length) await this.storage.removeRooms(sc.deletedRoomIds);

        if (sc.plants?.length) await this.storage.savePlants(sc.plants);
        if (sc.deletedPlantIds?.length) await this.storage.removePlants(sc.deletedPlantIds);

        if (sc.roomPlants?.length) await this.storage.saveRoomPlants(sc.roomPlants);
        if (sc.deletedRoomPlantIds?.length) await this.storage.removeRoomPlants(sc.deletedRoomPlantIds);

        if (sc.settings) await this.storage.saveSettings(sc.settings);
      }

      // Remove processed queue items
      const appliedIds = [
        ...(response.applied.spaces || []),
        ...(response.applied.rooms || []),
        ...(response.applied.plants || []),
        ...(response.applied.roomPlants || []),
      ];

      const queueToRemove = queue
        .filter((q) => appliedIds.includes(q.payload?.id) || q.entityType === 'watering_logs')
        .map((q) => q.id);

      await this.storage.removeQueueItems(queueToRemove);

      // Update sync metadata
      const newSyncDate = new Date(response.serverTime);
      this.lastSyncTime.set(newSyncDate);
      this.conflicts.set(response.conflicts || []);

      await this.storage.setMetadata({
        lastSyncAt: response.serverTime,
        lastSyncStatus: response.conflicts?.length ? 'conflict' : 'online-ok',
        conflicts: response.conflicts || [],
      });

      await this.refreshPendingCount();
    } catch (err: any) {
      // Offline or network error
      await this.refreshPendingCount();
    } finally {
      this.isSyncing.set(false);
    }
  }

  async downloadServerVersion(): Promise<void> {
    if (!this.isOnline()) {
      this.toast.error('Impossibile scaricare la versione del server: sei offline');
      return;
    }

    this.isSyncing.set(true);

    try {
      const state = await firstValueFrom(this.api.getFullState());

      await this.storage.clearAll();

      if (state.spaces?.length) await this.storage.saveSpaces(state.spaces);
      if (state.rooms?.length) await this.storage.saveRooms(state.rooms);
      if (state.plants?.length) await this.storage.savePlants(state.plants);
      if (state.roomPlants?.length) await this.storage.saveRoomPlants(state.roomPlants);
      if (state.settings) await this.storage.saveSettings(state.settings);

      const serverDate = new Date(state.serverTime);
      this.lastSyncTime.set(serverDate);
      this.conflicts.set([]);
      this.pendingCount.set(0);

      await this.storage.setMetadata({
        lastSyncAt: state.serverTime,
        lastSyncStatus: 'online-ok',
        conflicts: [],
      });
    } finally {
      this.isSyncing.set(false);
    }
  }

  async queueChange(
    entityType: 'spaces' | 'rooms' | 'plants' | 'room_plants' | 'settings' | 'watering_logs',
    action: 'create' | 'update' | 'delete',
    payload: any,
  ) {
    const item: SyncQueueItem = {
      id: Math.random().toString(36).substring(2, 9),
      entityType,
      action,
      payload,
      queuedAt: new Date().toISOString(),
    };

    await this.storage.enqueue(item);
    await this.refreshPendingCount();

    if (this.isOnline()) {
      void this.sync();
    }
  }
}

